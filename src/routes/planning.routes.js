const express = require("express");

const router = express.Router();

const planningController = require("../controllers/planning.controller");

const { authenticate } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");

const planningValidation = require("../validations/planning.validation");

router.post(
    "/",
    authenticate,
    validate(planningValidation.createPlanning),
    planningController.createPlanning
);

router.get(
    "/",
    authenticate,
    planningController.getAllPlanning
);

router.get(
    "/:id",
    authenticate,
    validate(planningValidation.planningId),
    planningController.getPlanningDetail
);

router.delete(
    "/:id",
    authenticate,
    validate(planningValidation.planningId),
    planningController.deletePlanning
);

module.exports = router;