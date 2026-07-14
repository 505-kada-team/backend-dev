const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
      index: true,
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
    },
    quantityDeducted: { type: Number, required: true },
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

stockMovementSchema.index({ inventoryId: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
