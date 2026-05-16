const Review = require("../Models/Review");
const Product = require("../Models/Product");
const Order = require("../Models/Order");
const logger = require("../utils/logger");
const { isValidObjectId } = require("../utils/validate");

const updateProductRating = async (productId) => {
  const stats = await Review.aggregate([
    { $match: { product: productId, isApproved: true } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Product.findByIdAndUpdate(productId, {
    "ratings.average": stats[0]?.avg ? Math.round(stats[0].avg * 10) / 10 : 0,
    "ratings.count": stats[0]?.count || 0,
  });
};

exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidObjectId(productId))
      return res.status(400).json({ message: "ID produit invalide" });
    const reviews = await Review.find({ product: productId, isApproved: true })
      .sort({ createdAt: -1 })
      .populate("user", "firstName lastName avatar");
    res.json(reviews);
  } catch (err) {
    logger.error("Erreur getProductReviews", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { productId, comment } = req.body;
    if (!isValidObjectId(productId))
      return res.status(400).json({ message: "ID produit invalide" });

    const rating = parseInt(req.body.rating);
    if (isNaN(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ message: "La note doit être entre 1 et 5" });

    const trimmedComment = String(comment || "").trim().slice(0, 1000);

    const existing = await Review.findOne({ user: req.user.id, product: productId });
    if (existing) return res.status(409).json({ message: "Vous avez déjà évalué ce produit" });

    const order = await Order.findOne({ user: req.user.id, "items.product": productId, status: "delivered" });
    const review = await Review.create({
      user: req.user.id,
      product: productId,
      rating,
      comment: trimmedComment,
      isVerifiedPurchase: !!order,
    });
    await updateProductRating(review.product);
    res.status(201).json(review);
  } catch (err) {
    logger.error("Erreur createReview", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!review) return res.status(404).json({ message: "Avis introuvable" });
    await updateProductRating(review.product);
    res.json({ message: "Avis supprimé" });
  } catch (err) {
    logger.error("Erreur deleteReview", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};
