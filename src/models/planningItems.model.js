const mongoose = require("mongoose");

const planningItemSchema = new mongoose.Schema(
    {
        planningId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Planning",
            required: true,
            index: true
        },

        menuId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Menu",
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("PlanningItem", planningItemSchema);