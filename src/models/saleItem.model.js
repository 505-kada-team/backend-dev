// src/models/saleItem.model.js
const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true,
    },
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu',
      required: true,
    },
    // Snapshot data menu SAAT transaksi terjadi — sengaja disimpan, bukan cuma
    // referensi. Kalau Menu-nya kelak diedit/dihapus, riwayat transaksi tetap
    // menunjukkan nama & harga yang benar-benar berlaku saat itu.
    menuName: { type: String, required: true },
    sellingPriceAtSale: { type: Number, required: true },
    costPriceAtSale: { type: Number, required: true },
    quantitySold: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SaleItem', saleItemSchema);
