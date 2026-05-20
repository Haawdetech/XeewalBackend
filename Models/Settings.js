const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    // Singleton : un seul document de settings
    singleton: { type: Boolean, default: true, unique: true },

    // Majoration globale des prix
    priceBoost: {
      active: { type: Boolean, default: false },
      percent: { type: Number, default: 20 },
    },

    // Réduction nouveaux clients (N premiers achats)
    newCustomerDiscount: {
      active: { type: Boolean, default: false },
      percent: { type: Number, default: 20 },
      maxOrders: { type: Number, default: 3 }, // nombre de commandes éligibles
    },
  },
  { timestamps: true }
);

// Toujours retourner le même document (singleton)
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ singleton: true });
  if (!settings) settings = await this.create({ singleton: true });
  return settings;
};

module.exports = mongoose.model("Settings", settingsSchema);
