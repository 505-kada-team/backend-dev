const mongoose = require('mongoose');
const Menu = require('../models/menu.model');
const MenuIngredient = require('../models/menuIngredient.model');
const Inventory = require('../models/inventory.model');
const ApiError = require('../utils/ApiError');

/**
 * Helper internal: gabungkan 1 dokumen Menu + ingredient-nya (sudah di-populate Inventory)
 * menjadi response shape yang disepakati (hargaPokok & laba dihitung, bukan disimpan).
 */
const buildMenuResponse = (menu, ingredients) => {
  const mappedIngredients = ingredients.map((ing) => {
    const hargaPokokPerBahan = ing.kuantitasDibutuhkan * ing.inventoryId.hargaPokok;
    return {
      id: ing._id,
      inventoryId: ing.inventoryId._id,
      nameBahan: ing.inventoryId.nameBahan,
      satuan: ing.inventoryId.satuan,
      kuantitasDibutuhkan: ing.kuantitasDibutuhkan,
      hargaPokokPerBahan,
    };
  });

  const hargaPokok = mappedIngredients.reduce((sum, i) => sum + i.hargaPokokPerBahan, 0);

  return {
    id: menu._id,
    name: menu.name,
    description: menu.description,
    sellingPrice: menu.sellingPrice, // harga jual milik Menu sendiri, tidak berhubungan dengan Inventory
    hargaPokok,
    laba: menu.sellingPrice - hargaPokok,
    ingredients: mappedIngredients,
  };
};

/**
 * Validasi bersama dipakai saat create & update:
 * 1. Tidak boleh ada inventoryId duplikat dalam satu payload.
 * 2. Setiap inventoryId WAJIB milik user yang sama dan benar-benar ada.
 *    Ini yang menegakkan aturan "menu hanya bisa dibuat dari inventory yang sudah ada".
 */
const validateIngredientsOwnership = async (ingredients, userId) => {
  const ids = ingredients.map((i) => i.inventoryId);

  const hasDuplicate = new Set(ids).size !== ids.length;
  if (hasDuplicate) {
    throw new ApiError(400, 'Terdapat inventoryId duplikat dalam ingredients');
  }

  const foundInventories = await Inventory.find({ _id: { $in: ids }, userId });

  if (foundInventories.length !== ids.length) {
    const foundIds = foundInventories.map((inv) => inv._id.toString());
    const missingIds = ids.filter((id) => !foundIds.includes(id));
    throw new ApiError(
      400,
      `Bahan berikut tidak ditemukan di inventory Anda: ${missingIds.join(', ')}`
    );
  }
};

const getAllMenus = async (userId) => {
  const menus = await Menu.find({ userId }).sort({ createdAt: -1 });

  // Ambil semua ingredient untuk semua menu sekaligus (hindari N+1 query per menu)
  const menuIds = menus.map((m) => m._id);
  const allIngredients = await MenuIngredient.find({ menuId: { $in: menuIds } }).populate(
    'inventoryId'
  );

  return menus.map((menu) => {
    const ingredientsForThisMenu = allIngredients.filter(
      (ing) => ing.menuId.toString() === menu._id.toString()
    );
    return buildMenuResponse(menu, ingredientsForThisMenu);
  });
};

const getMenuById = async (menuId, userId) => {
  const menu = await Menu.findOne({ _id: menuId, userId });
  if (!menu) {
    throw new ApiError(404, 'Menu tidak ditemukan');
  }

  const ingredients = await MenuIngredient.find({ menuId }).populate('inventoryId');
  return buildMenuResponse(menu, ingredients);
};

const createMenu = async ({ name, description, sellingPrice, ingredients }, userId) => {
  await validateIngredientsOwnership(ingredients, userId);

  // Pakai transaction supaya Menu + MenuIngredient sama-sama tersimpan atau sama-sama gagal.
  // Tanpa ini, kalau insert MenuIngredient gagal di tengah jalan, akan ada Menu "yatim"
  // tanpa ingredient sama sekali di database.
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const [menu] = await Menu.create([{ userId, name, description, sellingPrice }], { session });

      const ingredientDocs = ingredients.map((ing) => ({
        menuId: menu._id,
        inventoryId: ing.inventoryId,
        kuantitasDibutuhkan: ing.kuantitasDibutuhkan,
      }));
      const createdIngredients = await MenuIngredient.insertMany(ingredientDocs, { session });

      const populated = await MenuIngredient.populate(createdIngredients, {
        path: 'inventoryId',
      });
      result = buildMenuResponse(menu, populated);
    });
    return result;
  } finally {
    session.endSession();
  }
};

const updateMenu = async (menuId, payload, userId) => {
  const menu = await Menu.findOne({ _id: menuId, userId });
  if (!menu) {
    throw new ApiError(404, 'Menu tidak ditemukan');
  }

  const { name, description, sellingPrice, ingredients } = payload;

  if (ingredients) {
    await validateIngredientsOwnership(ingredients, userId);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      if (name !== undefined) menu.name = name;
      if (description !== undefined) menu.description = description;
      if (sellingPrice !== undefined) menu.sellingPrice = sellingPrice;
      await menu.save({ session });

      let finalIngredients;
      if (ingredients) {
        // Strategi "replace total": hapus semua ingredient lama, insert ulang yang baru.
        // Lebih sederhana & lebih kecil kemungkinan bug dibanding diff satu-satu.
        await MenuIngredient.deleteMany({ menuId: menu._id }, { session });

        const ingredientDocs = ingredients.map((ing) => ({
          menuId: menu._id,
          inventoryId: ing.inventoryId,
          kuantitasDibutuhkan: ing.kuantitasDibutuhkan,
        }));
        const createdIngredients = await MenuIngredient.insertMany(ingredientDocs, { session });
        finalIngredients = await MenuIngredient.populate(createdIngredients, {
          path: 'inventoryId',
        });
      } else {
        finalIngredients = await MenuIngredient.find({ menuId: menu._id }).populate('inventoryId');
      }

      result = buildMenuResponse(menu, finalIngredients);
    });
    return result;
  } finally {
    session.endSession();
  }
};

const deleteMenu = async (menuId, userId) => {
  const menu = await Menu.findOne({ _id: menuId, userId });
  if (!menu) {
    throw new ApiError(404, 'Menu tidak ditemukan');
  }

  // Guard: tolak hapus kalau menu ini masih dipakai di Planning manapun.
  // NOTE: butuh model PlanningItem dari modul Planning (Dev C). Kalau modul itu
  // belum di-merge, sementara guard ini bisa dikomentari dulu — tapi WAJIB
  // diaktifkan sebelum production, supaya tidak ada PlanningItem dengan menuId rusak.
  const PlanningItem = mongoose.models.PlanningItem;
  if (PlanningItem) {
    const usedInPlanning = await PlanningItem.exists({ menuId });
    if (usedInPlanning) {
      throw new ApiError(409, 'Menu tidak bisa dihapus karena masih dipakai di planning aktif');
    }
  }

  await MenuIngredient.deleteMany({ menuId });
  await menu.deleteOne();
};

module.exports = {
  getAllMenus,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
};
