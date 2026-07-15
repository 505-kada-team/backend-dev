const dashboardService = require("../services/dashboard.service");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

const getDashboardSummary = asyncHandler(async (req, res) => {
    const dashboard = await dashboardService.getDashboardSummary(req.user._id);

    return new ApiResponse(
        200,
        dashboard,
        "Dashboard retrieved successfully"
    ).send(res);
});

module.exports = {
    getDashboardSummary,
};