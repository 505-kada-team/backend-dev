const mongoose = require('mongoose');
const Planning = require('../models/planning.model');
const PlanningItem = require('../models/planningItems.model');
const Menu = require('../models/menu.model');
const MenuIngredient = require('../models/menuIngredient.model');

const ApiError = require('../utils/ApiError');

const materialCalculationService = require('./materialCalculation.service');

const createPlanning = async (body, userId) => {
  const { name, startDate, endDate, menus } = body;

  if (!name) {
    throw new ApiError(400, 'Planning name is required.');
  }

  if (!menus || menus.length === 0) {
    throw new ApiError(400, 'A planning must contain at least one menu.');
  }

  const menuIds = menus.map((menu) => menu.menuId);

  // Cegah duplikat menuId dalam satu payload (mis. user kirim menuId sama 2x)
  const hasDuplicate = new Set(menuIds).size !== menuIds.length;
  if (hasDuplicate) {
    throw new ApiError(400, 'Duplicate menu IDs are not allowed in a planning.');
  }

  // WAJIB filter by userId juga, bukan cuma cek _id ada atau tidak.
  // Tanpa ini user bisa bikin planning yang mereferensikan menu milik user lain.
  const menuDocs = await Menu.find({ _id: { $in: menuIds }, userId });

  if (menuDocs.length !== menuIds.length) {
    const foundIds = menuDocs.map((m) => m._id.toString());
    const missingIds = menuIds.filter((id) => !foundIds.includes(id));
    throw new ApiError(404, `The following menus were not found: ${missingIds.join(', ')}`);
  }

  // Transaction: Planning + PlanningItem harus sama-sama tersimpan atau sama-sama gagal.
  // Tanpa ini, kalau insertMany gagal di tengah jalan, akan ada Planning "yatim"
  // tanpa item sama sekali di database.
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const [planning] = await Planning.create([{ userId, name, startDate, endDate }], { session });

      const planningItems = menus.map((menu) => ({
        planningId: planning._id,
        menuId: menu.menuId,
        quantity: menu.quantity,
      }));
      await PlanningItem.insertMany(planningItems, { session });

      result = planning;
    });
    return result;
  } finally {
    session.endSession();
  }
};

const getPlanningDetail = async (planningId, userId) => {
  const planning = await Planning.findOne({
    _id: planningId,
    userId,
  });

  if (!planning) {
    throw new ApiError(404, 'Planning not found.');
  }

  const planningItems = await PlanningItem.find({
    planningId,
  }).populate('menuId');

  // Defensive guard: kalau ada PlanningItem yang menuId-nya sudah tidak ada
  // (data lama yang mungkin sempat corrupt sebelum guard delete diperbaiki),
  // jangan sampai crash — filter saja & idealnya log untuk investigasi manual.
  const validPlanningItems = planningItems.filter((item) => item.menuId !== null);

//   if (validPlanningItems.length !== planningItems.length) {
//     console.warn(
//       `Planning ${planningId} contains ${
//         planningItems.length - validPlanningItems.length
//       } planning item(s) referencing deleted menus.`
//     );
//   }

  const menuIds = validPlanningItems.map((item) => item.menuId._id);

  const menuIngredients = await MenuIngredient.find({
    menuId: {
      $in: menuIds,
    },
  }).populate('inventoryId');

  const materials = await materialCalculationService.calculateMaterials(
    validPlanningItems,
    menuIngredients
  );

  return {
    planning: {
      id: planning._id,
      name: planning.name,
      startDate: planning.startDate,
      endDate: planning.endDate,
    },

    materials,
  };
};

const getAllPlanning = async (userId) => {
  return await Planning.find({
    userId,
  }).sort({
    createdAt: -1,
  });
};

const deletePlanning = async (planningId, userId) => {
  const planning = await Planning.findOne({ _id: planningId, userId });
  if (!planning) {
    throw new ApiError(404, 'Planning not found.');
  }

  // PlanningItem adalah child murni milik Planning ini (tidak ada tabel lain
  // yang mereferensikan Planning), jadi aman untuk cascade-delete.
  // Tetap dibungkus transaction supaya tidak ada kondisi setengah-hapus.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await PlanningItem.deleteMany({ planningId }, { session });
      await planning.deleteOne({ session });
    });
  } finally {
    session.endSession();
  }
};

module.exports = {
  createPlanning,
  getPlanningDetail,
  getAllPlanning,
  deletePlanning,
};
