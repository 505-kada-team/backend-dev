const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    totalProfit: {
      type: Number,
      required: true,
      // snapshot total profit at the time of transaction, not recalculated later
    },
    menuNames: {
      type: [String],
      default: [],
      // denormalized snapshot of menu names in this sale, for search purposes only
    },
  },
  { timestamps: true }
);

saleSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
