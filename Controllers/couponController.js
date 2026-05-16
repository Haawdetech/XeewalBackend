const Coupon = require("../Models/Coupon");
const logger = require("../utils/logger");
const { isValidObjectId } = require("../utils/validate");

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    logger.error("Erreur getCoupons", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const { code, type, value, minOrderAmount, maxUses, expiresAt } = req.body;
    if (!code || !type || value === undefined)
      return res.status(400).json({ message: "Code, type et valeur requis" });
    const ALLOWED_TYPES = ["percentage", "fixed"];
    if (!ALLOWED_TYPES.includes(type))
      return res.status(400).json({ message: "Type de coupon invalide" });
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue) || parsedValue <= 0)
      return res.status(400).json({ message: "Valeur invalide" });
    if (type === "percentage" && parsedValue > 100)
      return res.status(400).json({ message: "Remise en pourcentage ne peut dépasser 100%" });

    const coupon = await Coupon.create({
      code: String(code).toUpperCase().trim().slice(0, 50),
      type,
      value: parsedValue,
      minOrderAmount: parseFloat(minOrderAmount) || 0,
      maxUses: parseInt(maxUses) || 0,
      expiresAt: expiresAt || null,
    });
    logger.info("Coupon créé", { code: coupon.code, adminId: req.user.id });
    res.status(201).json(coupon);
  } catch (err) {
    logger.error("Erreur createCoupon", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const { type, value, minOrderAmount, maxUses, expiresAt, isActive } = req.body;
    const update = {
      type,
      value: parseFloat(value),
      minOrderAmount: parseFloat(minOrderAmount) || 0,
      maxUses: parseInt(maxUses) || 0,
      expiresAt: expiresAt || null,
      isActive: isActive !== false,
    };
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!coupon) return res.status(404).json({ message: "Coupon introuvable" });
    res.json(coupon);
  } catch (err) {
    logger.error("Erreur updateCoupon", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    await Coupon.findByIdAndDelete(req.params.id);
    logger.info("Coupon supprimé", { couponId: req.params.id, adminId: req.user.id });
    res.json({ message: "Coupon supprimé" });
  } catch (err) {
    logger.error("Erreur deleteCoupon", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const { code, subtotal = 0 } = req.body;
    if (!code || typeof code !== "string")
      return res.status(400).json({ message: "Code requis" });
    const parsedSubtotal = parseFloat(subtotal) || 0;
    const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim().slice(0, 50), isActive: true });
    if (!coupon) return res.status(404).json({ message: "Code promo invalide" });
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return res.status(400).json({ message: "Code promo expiré" });
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return res.status(400).json({ message: "Code promo épuisé" });
    if (parsedSubtotal < coupon.minOrderAmount) return res.status(400).json({ message: `Montant minimum requis : ${coupon.minOrderAmount} FCFA` });
    const discount = coupon.type === "percentage"
      ? Math.round((parsedSubtotal * coupon.value) / 100)
      : coupon.value;
    res.json({
      valid: true,
      couponId: coupon._id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount: Math.min(discount, parsedSubtotal),
    });
  } catch (err) {
    logger.error("Erreur validateCoupon", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};
