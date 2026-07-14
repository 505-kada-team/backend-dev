const express = require("express");

const { getAllInventory, getInventoryOptions, getInventoryById, createInventory, updateInventory, deleteInventory} = require("../controllers/inventory.controller");
const { authenticate } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const inventoryValidation = require("../validations/inventory.validation");

const router = express.Router();


router.get(
    "/",
    authenticate,
    validate(inventoryValidation.getAllInventory),
    getAllInventory
);

// Get inventory options
router.get("/options", authenticate, getInventoryOptions);

// Get inventory by id
router.get("/:id", authenticate, getInventoryById);

// Create inventory
router.post(
    "/",
    authenticate,
    validate(inventoryValidation.createInventory),
    createInventory
);

// Update inventory
router.patch(
    "/:id",
    authenticate,
    validate(inventoryValidation.updateInventory),
    updateInventory
);

// Delete inventory
router.delete(
    "/:id",
    authenticate,
    deleteInventory
);

module.exports = router;