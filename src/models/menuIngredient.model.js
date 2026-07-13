const mongoose = require('mongoose');

const menuIngredientSchema = new mongoose.Schema(
  {
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu',
      required: true,
      index: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
      index: true,
    },
    quantityNeeded: {
      type: Number,
      required: true,
      min: 0,
      // jumlah bahan (dalam satuan Inventory terkait) yang dibutuhkan PER 1 PORSI menu
    },
  },
  { timestamps: true }
);

menuIngredientSchema.index({ menuId: 1, inventoryId: 1 }, { unique: true });
// unique: 1 menu tidak boleh punya baris duplikat untuk bahan yang sama

module.exports = mongoose.model('MenuIngredient', menuIngredientSchema);
