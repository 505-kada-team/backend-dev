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

/**
 * Single source of truth untuk menghitung biaya 1 ingredient dalam sebuah menu.
 *
 * `inventory.unitCost` BUKAN harga per satuan — itu adalah total biaya untuk
 * seluruh `inventory.quantity` yang dibeli/dicatat. Jadi harga per satuan harus
 * dicari dulu sebelum dikalikan dengan `quantityNeeded`.
 *
 * @param {{ unitCost: number, quantity: number }} inventory
 * @param {number} quantityNeeded - jumlah bahan yang dibutuhkan untuk 1 menu
 * @returns {number} costPerIngredient
 */
const calculateIngredientCost = (inventory, quantityNeeded) => {
  if (!inventory || !inventory.quantity || inventory.quantity <= 0) {
    // Stok 0/invalid: tidak bisa dihitung harga per satuan (divide by zero).
    // Kembalikan 0 daripada Infinity/NaN, tapi ini sebaiknya di-flag di layer
    // pemanggil (mis. warning "harga tidak akurat, stok inventory kosong").
    return 0;
  }

  const pricePerUnit = inventory.unitCost / inventory.quantity;
  return pricePerUnit * quantityNeeded;
};

/**
 * Hitung total costPrice dari list ingredient (hasil MenuIngredient.find().populate('inventoryId')).
 * Sekaligus mengembalikan breakdown per-ingredient dengan costPerIngredient masing-masing.
 *
 * @param {Array} ingredients - dokumen MenuIngredient yang sudah di-populate inventoryId
 * @returns {{ costPrice: number, breakdown: Array }}
 */
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

module.exports = { getMenuPricingMap };
