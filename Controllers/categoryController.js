const Category = require("../Models/Category");
const Product = require("../Models/Product");
const slugify = require("slugify");
const logger = require("../utils/logger");
const { isValidObjectId } = require("../utils/validate");

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).populate("parent", "name slug");
    res.json(categories);
  } catch (err) {
    logger.error("Erreur getCategories", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug, isActive: true }).populate("parent", "name slug");
    if (!category) return res.status(404).json({ message: "Catégorie introuvable" });
    const subCategories = await Category.find({ parent: category._id, isActive: true });
    const productCount = await Product.countDocuments({ category: category._id, isActive: true });
    res.json({ category, subCategories, productCount });
  } catch (err) {
    logger.error("Erreur getCategoryBySlug", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { nameFr, nameEn, descFr, descEn, parent, order } = req.body;
    if (!nameFr) return res.status(400).json({ message: "Nom de la catégorie requis" });

    // Valider le parent si fourni
    if (parent) {
      if (!isValidObjectId(parent))
        return res.status(400).json({ message: "ID parent invalide" });
      const parentExists = await Category.findById(parent);
      if (!parentExists) return res.status(404).json({ message: "Catégorie parent introuvable" });
    }

    const slug = slugify(nameFr, { lower: true, strict: true });
    const image = req.file ? req.file.location : "";
    const category = await Category.create({
      name: { fr: nameFr, en: nameEn || nameFr },
      slug,
      description: { fr: descFr || "", en: descEn || "" },
      image,
      parent: parent || null,
      order: parseInt(order) || 0,
    });
    logger.info("Catégorie créée", { categoryId: category._id, adminId: req.user.id });
    res.status(201).json(category);
  } catch (err) {
    logger.error("Erreur createCategory", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const { nameFr, nameEn, descFr, descEn, parent, order, isActive } = req.body;

    if (parent) {
      if (!isValidObjectId(parent))
        return res.status(400).json({ message: "ID parent invalide" });
      if (parent === req.params.id)
        return res.status(400).json({ message: "Une catégorie ne peut pas être son propre parent" });
    }

    const update = {
      name: { fr: nameFr, en: nameEn || nameFr },
      description: { fr: descFr || "", en: descEn || "" },
      parent: parent || null,
      order: parseInt(order) || 0,
      isActive: isActive !== "false",
    };
    if (req.file) update.image = req.file.location;
    const category = await Category.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!category) return res.status(404).json({ message: "Catégorie introuvable" });
    logger.info("Catégorie mise à jour", { categoryId: category._id, adminId: req.user.id });
    res.json(category);
  } catch (err) {
    logger.error("Erreur updateCategory", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const count = await Product.countDocuments({ category: req.params.id });
    if (count > 0) return res.status(400).json({ message: `Cette catégorie contient ${count} produit(s), désactivez-les d'abord` });
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    logger.info("Catégorie supprimée", { categoryId: req.params.id, adminId: req.user.id });
    res.json({ message: "Catégorie supprimée" });
  } catch (err) {
    logger.error("Erreur deleteCategory", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};
