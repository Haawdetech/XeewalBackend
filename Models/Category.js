const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      fr: { type: String, required: true, trim: true },
      en: { type: String, required: true, trim: true },
    },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: {
      fr: { type: String, default: "" },
      en: { type: String, default: "" },
    },
    image: { type: String, default: "" },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
