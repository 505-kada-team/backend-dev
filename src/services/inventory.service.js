const paginate = require("../utils/paginate");
const Inventory = require("../models/inventory.model");
const ApiError = require("../utils/ApiError");

const getAllInventory = async (userId, query) => {
    return await paginate(
        Inventory,
        { userId },
        query,
        {
            searchableFields: ["ingredientName"],
            defaultSort: "-createdAt",
            defaultLimit: 10,
        }
    );
};
// =======

const getInventoryById = async (inventoryId, userId) => {
    const inventory = await Inventory.findOne({
        _id: inventoryId,
        userId,
    });

    if (!inventory) {
        throw new ApiError(404, "Inventory not found");
    }

    return inventory;
};

const createInventory = async (userId, payload) => {
    const {
        ingredientName,
        description,
        unit,
        quantity,
        unitCost,
        validFrom,
        validTo,
    } = payload;

    const existingInventory = await Inventory.findOne({
        userId,
        ingredientName,
    });

    if (existingInventory) {
        throw new ApiError(
            409,
            "Ingredient already exists in inventory"
        );
    }

    const inventory = await Inventory.create({
        userId,
        ingredientName,
        description,
        unit,
        quantity,
        unitCost,
        validFrom,
        validTo,
    });

    return inventory;
};

const updateInventory = async (inventoryId, userId, payload) => {
    const inventory = await Inventory.findOne({
        _id: inventoryId,
        userId,
    });

    if (!inventory) {
        throw new ApiError(404, "Inventory not found");
    }

    Object.assign(inventory, payload);

    await inventory.save();

    return inventory;
};

const deleteInventory = async (inventoryId, userId) => {
    const inventory = await Inventory.findOne({
        _id: inventoryId,
        userId,
    });

    if (!inventory) {
        throw new ApiError(404, "Inventory not found");
    }

    await inventory.deleteOne();
};

const getInventoryOptions = async (userId) => {
    return await Inventory.find(
        { userId },
        {
            ingredientName: 1,
            unit: 1,
            quantity: 1,
        }
    ).sort({ ingredientName: 1 });
};

module.exports = {
    getAllInventory,
    getInventoryById,
    createInventory,
    updateInventory,
    deleteInventory,
    getInventoryOptions,
};