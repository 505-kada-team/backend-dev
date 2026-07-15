const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const { authenticate } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get(
    "/summary",
    authenticate,
    dashboardController.getDashboardSummary
);

module.exports = router;