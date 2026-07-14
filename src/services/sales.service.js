const Sale = require('../models/sale.model');
const SaleItem = require('../models/saleItem.model');
const StockMovement = require('../models/stockMovement.model');
const Inventory = require('../models/inventory.model');
const paginate = require('../utils/paginate');
const { getMenuPricingMap } = require('../utils/menuPricing');
const ApiError = require('../utils/ApiError');

/**
 * Gabungkan kebutuhan bahan dari beberapa item penjualan menjadi total per inventoryId.
 * Sama persis prinsipnya dengan agregasi di /planning/:id/preview.
 */
const aggregateInventoryRequirements = (items, pricingMap) => {
  const requirementMap = new Map();
  for (const item of items) {
    const pricing = pricingMap.get(item.menuId);
    for (const ing of pricing.ingredients) {
      const totalNeeded = ing.quantityNeeded * item.quantitySold;
      const current = requirementMap.get(ing.inventoryId) || 0;
      requirementMap.set(ing.inventoryId, current + totalNeeded);
    }
  }
  return requirementMap;
};

/**
 * Kurangi stok secara ATOMIK satu per satu. Kalau ada satu saja yang gagal
 * (stok tidak cukup / sudah keburu diambil transaksi lain), semua pengurangan
 * yang SUDAH berhasil di-rollback (dikembalikan) sebelum melempar error.
 *
 * Kondisi `kuantitas: { $gte: amount }` di filter adalah kunci atomicity-nya:
 * MongoDB menjamin baca-cek-tulis ini terjadi dalam satu operasi tak terpisahkan
 * di level dokumen, jadi tidak ada celah race condition seperti yang dibahas
 * sebelumnya (baca terpisah lalu tulis terpisah).
 */
const deductInventoryAtomic = async (userId, requirementMap) => {
  const succeededMovements = [];
  try {
    for (const [inventoryId, amount] of requirementMap.entries()) {
      const updated = await Inventory.findOneAndUpdate(
        { _id: inventoryId, userId, quantity: { $gte: amount } },
        { $inc: { quantity: -amount } },
        { new: true }
      );

      if (!updated) {
        const inv = await Inventory.findOne({ _id: inventoryId, userId });
        const ingredientName = inv ? inv.ingredientName : inventoryId;
        const available = inv ? inv.quantity : 0;
        throw new ApiError(
          409,
          `Stok tidak cukup untuk ${ingredientName}. Dibutuhkan ${amount}, tersedia ${available}`
        );
      }

      succeededMovements.push({
        inventoryId,
        quantityDeducted: amount,
        quantityBefore: updated.quantity + amount,
        quantityAfter: updated.quantity,
      });
    }
    return succeededMovements;
  } catch (err) {
    for (const movement of succeededMovements) {
      await Inventory.updateOne(
        { _id: movement.inventoryId, userId },
        { $inc: { quantity: movement.quantityDeducted } }
      );
    }
    throw err;
  }
};

const createSale = async ({ items }, userId) => {
  const menuIds = items.map((i) => i.menuId);
  const pricingMap = await getMenuPricingMap(menuIds, userId);

  const requirementMap = aggregateInventoryRequirements(items, pricingMap);
  const movements = await deductInventoryAtomic(userId, requirementMap);

  let totalProfit = 0;
  const menuNames = [];
  const saleItemDocs = items.map((item) => {
    const pricing = pricingMap.get(item.menuId);
    totalProfit += pricing.profit * item.quantitySold;
    menuNames.push(pricing.name);
    return {
      menuId: item.menuId,
      menuName: pricing.name,
      sellingPriceAtSale: pricing.sellingPrice,
      costPriceAtSale: pricing.costPrice,
      quantitySold: item.quantitySold,
    };
  });

  const sale = await Sale.create({ userId, totalProfit, menuNames });
  await SaleItem.insertMany(saleItemDocs.map((doc) => ({ ...doc, saleId: sale._id })));
  await StockMovement.insertMany(movements.map((m) => ({ ...m, userId, saleId: sale._id })));

  return getSaleById(sale._id, userId);
};

const getAllSales = async (userId, query) => {
  const baseFilter = { userId };

  if (query.startDate || query.endDate) {
    baseFilter.createdAt = {};
    if (query.startDate) baseFilter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      baseFilter.createdAt.$lte = end;
    }
  }

  const { data, meta } = await paginate(Sale, baseFilter, query, {
    searchableFields: ['menuNames'],
    defaultSort: '-createdAt',
  });

  const saleIds = data.map((s) => s._id);
  const allItems = await SaleItem.find({ saleId: { $in: saleIds } });

  const result = data.map((sale) => ({
    id: sale._id,
    totalProfit: sale.totalProfit,
    createdAt: sale.createdAt,
    items: allItems
      .filter((i) => i.saleId.toString() === sale._id.toString())
      .map((i) => ({
        menuName: i.menuName,
        quantitySold: i.quantitySold,
        sellingPriceAtSale: i.sellingPriceAtSale,
      })),
  }));

  return { data: result, meta };
};

const getSaleById = async (saleId, userId) => {
  const sale = await Sale.findOne({ _id: saleId, userId });
  if (!sale) throw new ApiError(404, 'Transaksi tidak ditemukan');

  const items = await SaleItem.find({ saleId });
  const movements = await StockMovement.find({ saleId });

  return {
    id: sale._id,
    totalProfit: sale.totalProfit,
    createdAt: sale.createdAt,
    items: items.map((i) => ({
      menuId: i.menuId,
      menuName: i.menuName,
      sellingPriceAtSale: i.sellingPriceAtSale,
      costPriceAtSale: i.costPriceAtSale,
      quantitySold: i.quantitySold,
    })),
    stockMovements: movements.map((m) => ({
      inventoryId: m.inventoryId,
      quantityDeducted: m.quantityDeducted,
      quantityBefore: m.quantityBefore,
      quantityAfter: m.quantityAfter,
    })),
  };
};

module.exports = { createSale, getAllSales, getSaleById };
