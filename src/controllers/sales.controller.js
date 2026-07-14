const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const salesService = require('../services/sales.service');

const getSales = asyncHandler(async (req, res) => {
  const { data, meta } = await salesService.getAllSales(req.user._id, req.query);
  return new ApiResponse(200, data, 'Sales retrieved successfully', meta).send(res);
});

const getSalesById = asyncHandler(async (req, res) => {
  const sale = await salesService.getSaleById(req.params.id, req.user._id);
  return new ApiResponse(200, sale, 'Sale details retrieved successfully').send(res);
});

const createSales = asyncHandler(async (req, res) => {
  const sale = await salesService.createSale(req.body, req.user._id);
  return new ApiResponse(201, sale, 'Sale recorded successfully').send(res);
});

module.exports = {
  getSales,
  getSalesById,
  createSales,
};
