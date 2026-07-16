const Planning = require("../models/planning.model");
const PlanningItem = require("../models/planningItems.model");
const MenuIngredient = require("../models/menuIngredient.model");
const Sale = require("../models/sale.model");

const materialCalculationService = require("./materialCalculation.service");

const getDashboardSummary = async (userId) => {
    // Ambil SEMUA planning milik user, bukan cuma satu.
    const plannings = await Planning.find({ userId }).sort({
        createdAt: -1,
    });

    // Total profit dari seluruh sales user (tidak terikat ke planning
    // tertentu, jadi dihitung sekali di luar loop).
    const sales = await Sale.find({ userId });
    const totalProfit = sales.reduce(
        (sum, sale) => sum + sale.totalProfit,
        0
    );

    // Tidak ada planning sama sekali
    if (plannings.length === 0) {
        return {
            plannings: [],
            totalProfit,
        };
    }

    // Hitung menuCapacity & remainingInventory untuk MASING-MASING planning.
    const planningSummaries = await Promise.all(
        plannings.map(async (planning) => {
            const planningItemsRaw = await PlanningItem.find({
                planningId: planning._id,
            }).populate("menuId");

            // Buang item yang menuId-nya null (menu sudah dihapus tapi
            // referensinya masih ada di PlanningItem / data yatim).
            const planningItems = planningItemsRaw.filter(
                (item) => item.menuId != null
            );

            const menuIds = planningItems.map(
                (item) => item.menuId._id
            );

            const menuIngredients = await MenuIngredient.find({
                menuId: { $in: menuIds },
            }).populate("inventoryId");

            // Remaining inventory setelah planning ini
            const remainingInventory =
                await materialCalculationService.calculateMaterials(
                    planningItems,
                    menuIngredients
                );

            // Maximum production untuk tiap menu di planning ini
            const menuCapacity = planningItems.map((item) => {
                const ingredients = menuIngredients.filter(
                    (ingredient) =>
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

                return {
                    menuId: item.menuId._id,
                    menuName: item.menuId.name,
                    maximumProduction,
                };
            });

            return {
                id: planning._id,
                planningName: planning.name,
                createdAt: planning.createdAt,
                menuCapacity,
                remainingInventory,
            };
        })
    );

    return {
        plannings: planningSummaries,
        totalProfit,
    };
};

module.exports = {
    getDashboardSummary,
};