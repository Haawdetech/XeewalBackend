const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema({
  name:       { type: String, required: true, maxlength: 100 },
  type:       { type: String, enum: ["global", "category"], required: true },
  percent:    { type: Number, required: true, min: 1, max: 90 },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  startDate:  { type: Date, required: true },
  endDate:    { type: Date, required: true },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

/** Retourne toutes les promos actuellement valides */
promotionSchema.statics.getActive = function () {
  const now = new Date();
  return this.find({ isActive: true, startDate: { $lte: now }, endDate: { $gte: now } })
    .populate("categoryId", "name");
};

module.exports = mongoose.model("Promotion", promotionSchema);
