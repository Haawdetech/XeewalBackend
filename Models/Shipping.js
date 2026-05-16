const mongoose = require("mongoose");

const shippingSchema = new mongoose.Schema(
  {
    name: {
      fr: { type: String, required: true },
      en: { type: String, required: true },
    },
    zones: [{ type: String, trim: true }],
    price: { type: Number, required: true, min: 0 },
    estimatedDays: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 3 },
    },
    isActive: { type: Boolean, default: true },
    isFreeAbove: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Shipping", shippingSchema);
