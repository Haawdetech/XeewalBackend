const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  options: [
    {
      value: { type: String, required: true },
      stock: { type: Number, default: 0 },
      priceAdjustment: { type: Number, default: 0 },
      sku: { type: String },
    },
  ],
});

const productSchema = new mongoose.Schema(
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
    shortDescription: {
      fr: { type: String, default: "" },
      en: { type: String, default: "" },
    },
    price: { type: Number, required: true, min: 0 },
    comparePrice: { type: Number, default: 0 },
    images: [{ type: String }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    tags: [{ type: String }],
    variants: [variantSchema],
    hasVariants: { type: Boolean, default: false },
    stock: { type: Number, default: 0 },
    sku: { type: String },
    weight: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isOnSale: { type: Boolean, default: false },
    salePercent: { type: Number, default: 0 },
    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    sold: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });

module.exports = mongoose.model("Product", productSchema);
