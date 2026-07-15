const MenuIngredient = require('../models/menuIngredient.model');
const Menu = require('../models/menu.model');
const ApiError = require('./ApiError');
const { calculateMenuCost } = require('./costCalculation');

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

module.exports = { getMenuPricingMap };
