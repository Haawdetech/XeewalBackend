const Shipping = require("../Models/Shipping");
const logger = require("../utils/logger");
const { isValidObjectId, safeJsonParse } = require("../utils/validate");

exports.getShippingZones = async (req, res) => {
  try {
    const zones = await Shipping.find({ isActive: true }).sort({ price: 1 });
    res.json(zones);
  } catch (err) {
    logger.error("Erreur getShippingZones", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.createShippingZone = async (req, res) => {
  try {
    const { nameFr, nameEn, price, estimatedDaysMin, estimatedDaysMax, isFreeAbove } = req.body;
    if (!nameFr) return res.status(400).json({ message: "Nom de la zone requis" });

    const zones = safeJsonParse(req.body.zones, []);
    if (!Array.isArray(zones)) return res.status(400).json({ message: "Format zones invalide" });

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ message: "Prix invalide" });

    const zone = await Shipping.create({
      name: { fr: nameFr, en: nameEn || nameFr },
      zones,
      price: parsedPrice,
      estimatedDays: { min: parseInt(estimatedDaysMin) || 1, max: parseInt(estimatedDaysMax) || 3 },
      isFreeAbove: parseFloat(isFreeAbove) || 0,
    });
    logger.info("Zone de livraison créée", { zoneId: zone._id, adminId: req.user.id });
    res.status(201).json(zone);
  } catch (err) {
    logger.error("Erreur createShippingZone", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.updateShippingZone = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const { nameFr, nameEn, price, estimatedDaysMin, estimatedDaysMax, isFreeAbove, isActive } = req.body;

    const zones = safeJsonParse(req.body.zones, []);
    if (!Array.isArray(zones)) return res.status(400).json({ message: "Format zones invalide" });

    const zone = await Shipping.findByIdAndUpdate(
      req.params.id,
      {
        name: { fr: nameFr, en: nameEn || nameFr },
        zones,
        price: parseFloat(price) || 0,
        estimatedDays: { min: parseInt(estimatedDaysMin) || 1, max: parseInt(estimatedDaysMax) || 3 },
        isFreeAbove: parseFloat(isFreeAbove) || 0,
        isActive: isActive !== "false",
      },
      { new: true }
    );
    if (!zone) return res.status(404).json({ message: "Zone introuvable" });
    logger.info("Zone de livraison mise à jour", { zoneId: zone._id, adminId: req.user.id });
    res.json(zone);
  } catch (err) {
    logger.error("Erreur updateShippingZone", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.deleteShippingZone = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    await Shipping.findByIdAndDelete(req.params.id);
    logger.info("Zone de livraison supprimée", { zoneId: req.params.id, adminId: req.user.id });
    res.json({ message: "Zone de livraison supprimée" });
  } catch (err) {
    logger.error("Erreur deleteShippingZone", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};
