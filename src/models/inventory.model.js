const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ingredientName: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      enum: ['gram', 'kg', 'ml', 'liter', 'pcs', 'piece'],
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      // Current available stock
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
      // Cost per unit (e.g. per gram, per ml, per piece)
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

inventorySchema.index({ userId: 1, ingredientName: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);