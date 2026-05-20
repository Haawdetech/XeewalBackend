const Settings = require("../Models/Settings");
const logger = require("../utils/logger");

// GET /api/settings — public (frontend en a besoin pour afficher les prix)
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings);
  } catch (err) {
    logger.error("Erreur getSettings", { error: err.message });
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// PUT /api/admin/settings — admin seulement
exports.updateSettings = async (req, res) => {
  try {
    const { priceBoost, newCustomerDiscount } = req.body;
    const settings = await Settings.getSettings();

    if (priceBoost !== undefined) {
      if (typeof priceBoost.active === "boolean") settings.priceBoost.active = priceBoost.active;
      if (priceBoost.percent > 0) settings.priceBoost.percent = priceBoost.percent;
    }

    if (newCustomerDiscount !== undefined) {
      if (typeof newCustomerDiscount.active === "boolean") settings.newCustomerDiscount.active = newCustomerDiscount.active;
      if (newCustomerDiscount.percent > 0) settings.newCustomerDiscount.percent = newCustomerDiscount.percent;
      if (newCustomerDiscount.maxOrders > 0) settings.newCustomerDiscount.maxOrders = newCustomerDiscount.maxOrders;
    }

    await settings.save();
    logger.info("Settings mis à jour", { admin: req.user?.id, priceBoost: settings.priceBoost, newCustomerDiscount: settings.newCustomerDiscount });
    res.json(settings);
  } catch (err) {
    logger.error("Erreur updateSettings", { error: err.message });
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET /api/eligibility — vérifie si l'utilisateur actuel est éligible à la réduction
exports.checkEligibility = async (req, res) => {
  try {
    const Settings = require("../Models/Settings");
    const { checkNewCustomerEligibility } = require("../utils/pricing");

    const settings = await Settings.getSettings();
    const email = req.query.email || req.user?.email;
    const userId = req.user?.id || null;

    const result = await checkNewCustomerEligibility(userId, email, settings);

    res.json({
      eligible: result.eligible,
      remaining: result.remaining,
      percent: settings.newCustomerDiscount.percent,
      active: settings.newCustomerDiscount.active,
      priceBoost: settings.priceBoost,
    });
  } catch (err) {
    logger.error("Erreur checkEligibility", { error: err.message });
    res.status(500).json({ message: "Erreur serveur" });
  }
};
