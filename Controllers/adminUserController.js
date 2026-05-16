const User = require("../Models/User");
const logger = require("../utils/logger");
const { safeRegex, isValidObjectId, parsePagination } = require("../utils/validate");

const ALLOWED_ROLES = ["client", "admin"];

exports.getUsers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 100);
    const { search } = req.query;
    const filter = {};
    if (search) {
      const rx = safeRegex(String(search).slice(0, 100));
      filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-password"),
      User.countDocuments(filter),
    ]);
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error("Erreur getUsers", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    // Empêcher un admin de se modifier lui-même via cette route
    if (req.params.id === req.user.id)
      return res.status(400).json({ message: "Vous ne pouvez pas modifier votre propre compte ici" });

    const { isBlocked, role } = req.body;
    const update = {};
    if (isBlocked !== undefined) update.isBlocked = !!isBlocked;
    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(role))
        return res.status(400).json({ message: "Rôle invalide" });
      update.role = role;
    }
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    logger.info("Utilisateur mis à jour", { targetId: req.params.id, update, adminId: req.user.id });
    res.json(user);
  } catch (err) {
    logger.error("Erreur updateUser", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    if (req.params.id === req.user.id)
      return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte" });
    await User.findByIdAndDelete(req.params.id);
    logger.warn("Utilisateur supprimé", { targetId: req.params.id, adminId: req.user.id });
    res.json({ message: "Utilisateur supprimé" });
  } catch (err) {
    logger.error("Erreur deleteUser", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};
