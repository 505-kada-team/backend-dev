const calculateMaterials = async (planningItems, menuIngredients) => {
    const materialMap = new Map();

    for (const planningItem of planningItems) {

        // Ambil semua ingredient untuk menu ini
        const ingredients = menuIngredients.filter((ingredient) => {
            return ingredient.menuId.toString() === planningItem.menuId._id.toString();
        });

        for (const ingredient of ingredients) {

            const inventory = ingredient.inventoryId;

            const key = inventory._id.toString();

            const needed =
                ingredient.quantityNeeded * planningItem.quantity;

            if (!materialMap.has(key)) {

                materialMap.set(key, {
                    inventoryId: inventory._id,
                    ingredientName: inventory.ingredientName,
                    unit: inventory.unit,

                    needed,
                    available: inventory.quantity,

                    menus: [
                        {
                            menuId: planningItem.menuId._id,
                            menuName: planningItem.menuId.name,
                            menuQuantity: planningItem.quantity,
                            quantityPerMenu: ingredient.quantityNeeded,
                            needed,
                        },
                    ],
                });

            } else {

                const material = materialMap.get(key);

                material.needed += needed;

                material.menus.push({
                    menuId: planningItem.menuId._id,
                    menuName: planningItem.menuId.name,
                    menuQuantity: planningItem.quantity,
                    quantityPerMenu: ingredient.quantityNeeded,
                    needed,
                });

            }

        }

    }

    return [...materialMap.values()].map((material) => ({
        inventoryId: material.inventoryId,
        ingredientName: material.ingredientName,
        unit: material.unit,

        needed: material.needed,
        available: material.available,

        shortage: Math.max(0, material.needed - material.available),

        status:
            material.needed <= material.available
                ? "CUKUP"
                : "KURANG",

        menus: material.menus,
    }));
};

module.exports = {
    calculateMaterials,
};