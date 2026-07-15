const Planning = require("../models/planning.model");
const PlanningItem = require("../models/planningItems.model");
const MenuIngredient = require("../models/menuIngredient.model");
const Sale = require("../models/sale.model");

const materialCalculationService = require("./materialCalculation.service");

const getDashboardSummary = async (userId) => {
    const planning = await Planning.findOne({ userId })
        .sort({ createdAt: -1 });

    // No active planning
    if (!planning) {
        return {
            activePlanning: null,
            totalProfit: 0,
            menuCapacity: [],
            remainingInventory: [],
        };
    }

    const planningItems = await PlanningItem.find({
        planningId: planning._id,
    }).populate("menuId");

    const menuIds = planningItems.map(item => item.menuId._id);

    const menuIngredients = await MenuIngredient.find({
        menuId: {
            $in: menuIds,
        },
    }).populate("inventoryId");

    // Remaining inventory after planning
    const remainingInventory =
        await materialCalculationService.calculateMaterials(
            planningItems,
            menuIngredients
        );

    // Total profit from sales
    const sales = await Sale.find({ userId });

    const totalProfit = sales.reduce(
        (sum, sale) => sum + sale.totalProfit,
        0
    );

    // Maximum production for each menu
    const menuCapacity = [];

    for (const item of planningItems) {
        const ingredients = menuIngredients.filter(
            ingredient =>
                ingredient.menuId.toString() ===
                item.menuId._id.toString()
        );

        let maximumProduction = Infinity;

        for (const ingredient of ingredients) {
            const inventory = ingredient.inventoryId;

            const possible = Math.floor(
                inventory.quantity /
                ingredient.quantityNeeded
            );

            maximumProduction = Math.min(
                maximumProduction,
                possible
            );
        }

        menuCapacity.push({
            menuId: item.menuId._id,
            menuName: item.menuId.name,
            maximumProduction,
        });
    }

    return {
        activePlanning: {
            id: planning._id,
            planningName: planning.name,
        },
        totalProfit,
        menuCapacity,
        remainingInventory,
    };
};

module.exports = {
    getDashboardSummary,
};