const Planning = require("../models/planning.model");
const PlanningItem = require("../models/planningItems.model");
const Menu = require("../models/menu.model");
const MenuIngredient = require("../models/menuIngredient.model");

const ApiError = require("../utils/ApiError");

const materialCalculationService = require("./materialCalculation.service");

const createPlanning = async (body, userId) => {
    const {name,startDate,endDate,menus} = body;

    if (!name) {
        throw new ApiError(400, "Nama planning wajib diisi.");
    }

    if (!menus || menus.length === 0) {
        throw new ApiError(400,"Planning minimal memiliki satu menu");
    }

    const menuIds = menus.map(menu => menu.menuId);
    const menuDocs = await Menu.find({_id: {$in: menuIds}});

    if (menuDocs.length !== menuIds.length) {
        throw new ApiError(404,"Terdapat menu yang tidak ditemukan.");
    }

    const planning = await Planning.create({userId,name,startDate,endDate});
    const planningItems = menus.map(menu => ({
        planningId: planning._id,
        menuId: menu.menuId,
        quantity: menu.quantity
    }));
    await PlanningItem.insertMany(planningItems);
    return planning;
};

const getPlanningDetail = async (planningId, userId) => {

    const planning = await Planning.findOne({
        _id: planningId,
        userId,
    });

    if (!planning) {
        throw new ApiError(404, "Planning tidak ditemukan.");
    }

    const planningItems = await PlanningItem.find({
        planningId,
    }).populate("menuId");

    const menuIds = planningItems.map((item) => item.menuId._id);

    const menuIngredients = await MenuIngredient.find({
        menuId: {
            $in: menuIds,
        },
    }).populate("inventoryId");

    const materials =
        await materialCalculationService.calculateMaterials(
            planningItems,
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
        userId
    }).sort({
        createdAt: -1
    });
};

const deletePlanning = async ( planningId,userId) => {
    const planning = await Planning.findOne({_id: planningId,userId});
    if (!planning) {
        throw new ApiError(404,"Planning tidak ditemukan.");
    }

    await PlanningItem.deleteMany({planningId});
    await planning.deleteOne();
};

module.exports = {
    createPlanning,
    getPlanningDetail,
    getAllPlanning,
    deletePlanning
};