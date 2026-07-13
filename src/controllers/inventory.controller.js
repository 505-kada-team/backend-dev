const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const inventoryService = require("../services/inventory.service");

const getAllInventory = asyncHandler(async (req, res) => {
    const data = await inventoryService.getAllInventory(req.user._id);

    return new ApiResponse(
        200,
        data,
        "Inventory retrieved successfully."
    ).send(res);
});

const getInventoryById = asyncHandler(async (req, res) => {
    const data = await inventoryService.getInventoryById(
        req.params.id,
        req.user._id
    );

    return new ApiResponse(
        200,
        data,
        "Inventory retrieved successfully."
    ).send(res);
});

const createInventory = asyncHandler(async (req, res) => {
    const data = await inventoryService.createInventory(
        req.user._id,
        req.body
    );

    return new ApiResponse(
        201,
        data,
        "Inventory created successfully."
    ).send(res);
});

const updateInventory = asyncHandler(async (req, res) => {
    const data = await inventoryService.updateInventory(
        req.params.id,
        req.user._id,
        req.body
    );

    return new ApiResponse(
        200,
        data,
        "Inventory updated successfully."
    ).send(res);
});

const deleteInventory = asyncHandler(async (req, res) => {
    await inventoryService.deleteInventory(
        req.params.id,
        req.user._id
    );

    return new ApiResponse(
        200,
        null,
        "Inventory deleted successfully."
    ).send(res);
});

const getInventoryOptions = asyncHandler(async (req, res) => {
    const data = await inventoryService.getInventoryOptions(req.user._id);

    return new ApiResponse(
        200,
        data,
        "Inventory options retrieved successfully."
    ).send(res);
});

module.exports = {
    getAllInventory,
    getInventoryById,
    createInventory,
    updateInventory,
    deleteInventory,
    getInventoryOptions,
};