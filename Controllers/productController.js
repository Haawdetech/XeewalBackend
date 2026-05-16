const Product = require("../Models/Product");
const slugify = require("slugify");
const logger = require("../utils/logger");
const { safeRegex, isValidObjectId, parsePagination, safeJsonParse } = require("../utils/validate");

exports.getProducts = async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort, featured, onSale } = req.query;
    const { page, limit, skip } = parsePagination(req.query, 100);
    const filter = { isActive: true };
    if (category && isValidObjectId(category)) filter.category = category;
    if (featured === "true") filter.isFeatured = true;
    if (onSale === "true") filter.isOnSale = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      const min = parseFloat(minPrice);
      const max = parseFloat(maxPrice);
      if (!isNaN(min) && min >= 0) filter.price.$gte = min;
      if (!isNaN(max) && max >= 0) filter.price.$lte = max;
    }
    if (search) {
      const rx = safeRegex(String(search).slice(0, 100));
      filter.$or = [{ "name.fr": rx }, { "name.en": rx }, { tags: rx }];
    }

    const sortMap = { price_asc: { price: 1 }, price_desc: { price: -1 }, newest: { createdAt: -1 }, popular: { sold: -1 } };
    const sortOption = sortMap[sort] || { createdAt: -1 };

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortOption).skip(skip).limit(limit).populate("category", "name slug"),
      Product.countDocuments(filter),
    ]);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error("Erreur getProducts", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getProductById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const product = await Product.findById(req.params.id).populate("category", "name slug");
    if (!product) return res.status(404).json({ message: "Produit introuvable" });
    res.json(product);
  } catch (err) {
    logger.error("Erreur getProductById", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate("category", "name slug");
    if (!product) return res.status(404).json({ message: "Produit introuvable" });
    res.json(product);
  } catch (err) {
    logger.error("Erreur getProductBySlug", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getRelatedProducts = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) return res.status(404).json({ message: "Produit introuvable" });
    const related = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isActive: true,
    }).limit(6).populate("category", "name slug");
    res.json(related);
  } catch (err) {
    logger.error("Erreur getRelatedProducts", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { nameFr, nameEn, descFr, descEn, shortDescFr, shortDescEn, price, comparePrice, category, sku, weight, isFeatured, isOnSale, salePercent } = req.body;

    if (!nameFr) return res.status(400).json({ message: "Nom du produit requis" });
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ message: "Prix invalide" });
    const parsedStock = parseInt(req.body.stock) || 0;
    if (parsedStock < 0) return res.status(400).json({ message: "Stock invalide" });

    const tags = safeJsonParse(req.body.tags, []);
    const variants = safeJsonParse(req.body.variants, []);
    if (!Array.isArray(tags) || !Array.isArray(variants))
      return res.status(400).json({ message: "Format tags/variants invalide" });

    const slug = slugify(nameFr, { lower: true, strict: true }) + "-" + Date.now();
    const images = req.files ? req.files.map((f) => f.location) : [];

    const product = await Product.create({
      name: { fr: nameFr, en: nameEn || nameFr },
      slug,
      description: { fr: descFr || "", en: descEn || "" },
      shortDescription: { fr: shortDescFr || "", en: shortDescEn || "" },
      price: parsedPrice,
      comparePrice: parseFloat(comparePrice) || 0,
      images,
      category: category || null,
      tags,
      variants,
      hasVariants: variants.length > 0,
      stock: parsedStock,
      sku: sku ? String(sku).slice(0, 100) : undefined,
      weight: parseFloat(weight) || 0,
      isFeatured: isFeatured === "true",
      isOnSale: isOnSale === "true",
      salePercent: parseFloat(salePercent) || 0,
    });
    logger.info("Produit créé", { productId: product._id, adminId: req.user.id });
    res.status(201).json(product);
  } catch (err) {
    logger.error("Erreur createProduct", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const { nameFr, nameEn, descFr, descEn, shortDescFr, shortDescEn, price, comparePrice, category, sku, weight, isFeatured, isOnSale, salePercent, isActive } = req.body;

    const tags = safeJsonParse(req.body.tags, []);
    const variants = safeJsonParse(req.body.variants, []);
    const existingImages = safeJsonParse(req.body.existingImages, []);
    if (!Array.isArray(tags) || !Array.isArray(variants) || !Array.isArray(existingImages))
      return res.status(400).json({ message: "Format invalide" });

    const newImages = req.files ? req.files.map((f) => f.location) : [];
    const images = [...existingImages, ...newImages];

    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(req.body.stock);

    const update = {
      name: { fr: nameFr, en: nameEn || nameFr },
      description: { fr: descFr || "", en: descEn || "" },
      shortDescription: { fr: shortDescFr || "", en: shortDescEn || "" },
      price: isNaN(parsedPrice) ? undefined : parsedPrice,
      comparePrice: parseFloat(comparePrice) || 0,
      images,
      category: category || null,
      tags,
      variants,
      hasVariants: variants.length > 0,
      stock: isNaN(parsedStock) ? undefined : Math.max(0, parsedStock),
      sku: sku ? String(sku).slice(0, 100) : undefined,
      weight: parseFloat(weight) || 0,
      isFeatured: isFeatured === "true",
      isOnSale: isOnSale === "true",
      salePercent: parseFloat(salePercent) || 0,
      isActive: isActive !== "false",
    };
    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!product) return res.status(404).json({ message: "Produit introuvable" });
    logger.info("Produit mis à jour", { productId: product._id, adminId: req.user.id });
    res.json(product);
  } catch (err) {
    logger.error("Erreur updateProduct", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    logger.info("Produit désactivé", { productId: req.params.id, adminId: req.user.id });
    res.json({ message: "Produit supprimé" });
  } catch (err) {
    logger.error("Erreur deleteProduct", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getAllProductsAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 100);
    const { search } = req.query;
    const filter = {};
    if (search) {
      const rx = safeRegex(String(search).slice(0, 100));
      filter.$or = [{ "name.fr": rx }, { sku: rx }];
    }
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("category", "name"),
      Product.countDocuments(filter),
    ]);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error("Erreur getAllProductsAdmin", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};
