const Promotion = require("../Models/Promotion");
const logger = require("../utils/logger");
const { isValidObjectId } = require("../utils/validate");

// GET /promotions/active — public
exports.getActive = async (req, res) => {
  try {
    const promos = await Promotion.getActive();
    res.json(promos);
  } catch (err) {
    logger.error("Erreur getActive promotions", { error: err.message });
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET /admin/promotions — liste toutes
exports.getAll = async (req, res) => {
  try {
    const promos = await Promotion.find().sort({ createdAt: -1 }).populate("categoryId", "name");
    res.json(promos);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// POST /admin/promotions — créer
exports.create = async (req, res) => {
  try {
    const { name, type, percent, categoryId, startDate, endDate, isActive } = req.body;
    if (!name || !type || !percent || !startDate || !endDate)
      return res.status(400).json({ message: "Champs manquants" });
    if (type === "category" && !isValidObjectId(categoryId))
      return res.status(400).json({ message: "Catégorie invalide" });
    const promo = await Promotion.create({
      name: String(name).slice(0, 100),
      type,
      percent: Number(percent),
      categoryId: type === "category" ? categoryId : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: isActive !== false,
    });
    logger.info("Promotion créée", { id: promo._id, name, adminId: req.user.id });
    res.status(201).json(promo);
  } catch (err) {
    logger.error("Erreur create promotion", { error: err.message });
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// PUT /admin/promotions/:id — modifier
exports.update = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const { name, type, percent, categoryId, startDate, endDate, isActive } = req.body;
    const update = {};
    if (name)      update.name      = String(name).slice(0, 100);
    if (type)      update.type      = type;
    if (percent)   update.percent   = Number(percent);
    if (startDate) update.startDate = new Date(startDate);
    if (endDate)   update.endDate   = new Date(endDate);
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (type === "category" && categoryId) update.categoryId = categoryId;
    if (type === "global") update.categoryId = null;

    const promo = await Promotion.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!promo) return res.status(404).json({ message: "Promotion introuvable" });
    res.json(promo);
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// DELETE /admin/promotions/:id
exports.remove = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    await Promotion.findByIdAndDelete(req.params.id);
    res.json({ message: "Supprimée" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};
