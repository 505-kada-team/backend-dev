const MenuIngredient = require('../models/menuIngredient.model');
const Menu = require('../models/menu.model');
const ApiError = require('./ApiError');

/**
 * Single source of truth untuk menghitung biaya 1 ingredient dalam sebuah menu.
 */
const calculateIngredientCost = (inventory, quantityNeeded) => {
  if (!inventory || !inventory.quantity || inventory.quantity <= 0) {
    return 0;
  }
  const pricePerUnit = inventory.unitCost / inventory.quantity;
  return pricePerUnit * quantityNeeded;
};

const calculateMenuCost = (ingredients) => {
  const breakdown = ingredients.map((ing) => {
    const inventory = ing.inventoryId;
    const costPerIngredient = calculateIngredientCost(inventory, ing.quantityNeeded);
    return {
      id: ing._id,
      inventoryId: inventory._id,
      ingredientName: inventory.ingredientName,
      unit: inventory.unit,
      quantityNeeded: ing.quantityNeeded,
      costPerIngredient,
    };
  });

  const costPrice = breakdown.reduce((sum, i) => sum + i.costPerIngredient, 0);
  return { costPrice, breakdown };
};

/**
 * Ambil beberapa Menu sekaligus + hitung hargaPokok & laba masing-masing.
 */
const getMenuPricingMap = async (menuIds, userId) => {
  const menus = await Menu.find({ _id: { $in: menuIds }, userId });

  if (menus.length !== new Set(menuIds).size) {
    const foundIds = menus.map((m) => m._id.toString());
    const missing = menuIds.filter((id) => !foundIds.includes(id));
    throw new ApiError(400, `Menu berikut tidak ditemukan: ${missing.join(', ')}`);
  }

  const allIngredients = await MenuIngredient.find({
    menuId: { $in: menuIds },
  }).populate('inventoryId');

  const pricingMap = new Map();
  for (const menu of menus) {
    const ingredients = allIngredients.filter(
      (ing) => ing.menuId.toString() === menu._id.toString()
    );

    // Pakai helper yang sama, bukan hitung manual lagi di sini.
    const { costPrice, breakdown } = calculateMenuCost(ingredients);

    pricingMap.set(menu._id.toString(), {
      name: menu.name,
      sellingPrice: menu.sellingPrice,
      costPrice,
      profit: menu.sellingPrice - costPrice,
      ingredients: breakdown.map((b) => ({
        inventoryId: b.inventoryId.toString(),
        ingredientName: b.ingredientName,
        unit: b.unit,
        quantityNeeded: b.quantityNeeded,
      })),
    });
  }

  return pricingMap;
};

module.exports = { getMenuPricingMap, calculateIngredientCost, calculateMenuCost };
