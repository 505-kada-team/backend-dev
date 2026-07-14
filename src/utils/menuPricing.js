const MenuIngredient = require('../models/menuIngredient.model');
const Menu = require('../models/menu.model');
const ApiError = require('./ApiError');

/**
 * Ambil beberapa Menu sekaligus + hitung hargaPokok & laba masing-masing.
 * Melempar ApiError kalau ada menuId yang tidak ditemukan / bukan milik user.
 * @returns {Map<string, {nama, hargaJual, hargaPokok, laba, ingredients}>}
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
    const costPrice = ingredients.reduce(
      (sum, ing) => sum + ing.quantityNeeded * ing.inventoryId.unitCost,
      0
    );
    pricingMap.set(menu._id.toString(), {
      name: menu.name,
      sellingPrice: menu.sellingPrice,
      costPrice,
      profit: menu.sellingPrice - costPrice,
      ingredients: ingredients.map((ing) => ({
        inventoryId: ing.inventoryId._id.toString(),
        ingredientName: ing.inventoryId.ingredientName,
        unit: ing.inventoryId.unit,
        quantityNeeded: ing.quantityNeeded,
      })),
    });
  }

  return pricingMap;
};

module.exports = { getMenuPricingMap };
