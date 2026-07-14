const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const menuService = require('../services/menu.service');

const getMenu = asyncHandler(async (req, res) => {
    const menus = await menuService.getAllMenus(req.user._id, req.query
);  return new ApiResponse(200, menus, 'Menu list retrieved successfully').send(res);
});

const getMenuById = asyncHandler(async (req, res) => {
  const menu = await menuService.getMenuById(req.params.id, req.user._id);
  return new ApiResponse(200, menu, 'Menu details retrieved successfully').send(res);
});

const createMenu = asyncHandler(async (req, res) => {
  const menu = await menuService.createMenu(req.body, req.user._id);
  return new ApiResponse(201, menu, 'Menu created successfully').send(res);
});

const updateMenu = asyncHandler(async (req, res) => {
  const menu = await menuService.updateMenu(req.params.id, req.body, req.user._id);
  return new ApiResponse(200, menu, 'Menu updated successfully').send(res);
});

const deleteMenu = asyncHandler(async (req, res) => {
  await menuService.deleteMenu(req.params.id, req.user._id);
  return new ApiResponse(200, null, 'Menu deleted successfully').send(res);
});

module.exports = {
  getMenu,
  getMenuById,
  createMenu,
  updateMenu,
  deleteMenu,
};
