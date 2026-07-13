const mongoose = require('mongoose');

const planningSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'final'],
      default: 'draft',
      // 'final' = planning yang dipakai untuk kalkulasi Dashboard
      // hanya boleh ada 1 planning 'final' aktif per user (dicek di service)
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Planning', planningSchema);