const Cart = require("../Models/Cart");
const Product = require("../Models/Product");
const Coupon = require("../Models/Coupon");

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate("items.product", "name price images stock isActive slug");
    if (!cart) return res.json({ items: [], subtotal: 0, couponDiscount: 0, total: 0 });
    const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal - cart.couponDiscount;
    res.json({ ...cart.toObject(), subtotal, total });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, selectedVariants = [] } = req.body;
    const product = await Product.findById(productId);
    if (!product || !product.isActive) return res.status(404).json({ message: "Produit introuvable" });
    if (product.stock < quantity) return res.status(400).json({ message: "Stock insuffisant" });

    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) cart = new Cart({ user: req.user.id, items: [] });

    const existingIdx = cart.items.findIndex(
      (i) => i.product.toString() === productId && JSON.stringify(i.selectedVariants) === JSON.stringify(selectedVariants)
    );
    if (existingIdx > -1) {
      cart.items[existingIdx].quantity += Number(quantity);
    } else {
      cart.items.push({ product: productId, quantity: Number(quantity), selectedVariants, price: product.price });
    }
    await cart.save();
    res.json({ message: "Produit ajouté au panier" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return res.status(404).json({ message: "Panier introuvable" });
    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: "Article introuvable" });
    if (quantity <= 0) cart.items.pull(req.params.itemId);
    else item.quantity = Number(quantity);
    await cart.save();
    res.json({ message: "Panier mis à jour" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return res.status(404).json({ message: "Panier introuvable" });
    cart.items.pull(req.params.itemId);
    await cart.save();
    res.json({ message: "Article supprimé" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user.id }, { items: [], coupon: null, couponDiscount: 0 });
    res.json({ message: "Panier vidé" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.applyCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const coupon = await Coupon.findOne({ code, isActive: true });
    if (!coupon) return res.status(404).json({ message: "Code promo invalide" });
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return res.status(400).json({ message: "Code promo expiré" });
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return res.status(400).json({ message: "Code promo épuisé" });
    if (coupon.usedBy.includes(req.user.id)) return res.status(400).json({ message: "Vous avez déjà utilisé ce code" });

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) return res.status(404).json({ message: "Panier vide" });
    const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
    if (subtotal < coupon.minOrderAmount) return res.status(400).json({ message: `Montant minimum requis: ${coupon.minOrderAmount} FCFA` });

    const discount = coupon.type === "percentage" ? (subtotal * coupon.value) / 100 : coupon.value;
    cart.coupon = coupon._id;
    cart.couponDiscount = Math.min(discount, subtotal);
    await cart.save();
    res.json({ message: "Code promo appliqué", discount: cart.couponDiscount });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.removeCoupon = async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user.id }, { coupon: null, couponDiscount: 0 });
    res.json({ message: "Code promo retiré" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};
