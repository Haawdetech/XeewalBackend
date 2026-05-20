const Order = require("../Models/Order");
const Cart = require("../Models/Cart");
const Product = require("../Models/Product");
const Coupon = require("../Models/Coupon");
const Shipping = require("../Models/Shipping");
const Notification = require("../Models/Notification");
const Settings = require("../Models/Settings");
const paydunya = require("../Services/paydunya");
const mailer = require("../Services/mailer");
const User = require("../Models/User");
const logger = require("../utils/logger");
const { isValidObjectId, parsePagination, safeRegex, isValidEmail, isValidPhone } = require("../utils/validate");
const { applyPriceBoost, checkNewCustomerEligibility, calcNewCustomerDiscount } = require("../utils/pricing");

const ALLOWED_PAYMENT_METHODS = ["paydunya", "cash_on_delivery"];

exports.createOrder = async (req, res) => {
  try {
    const { shippingAddress, shippingZoneId, paymentMethod = "paydunya", notes } = req.body;

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod))
      return res.status(400).json({ message: "Méthode de paiement invalide" });
    if (!isValidObjectId(shippingZoneId))
      return res.status(400).json({ message: "Zone de livraison invalide" });

    const cart = await Cart.findOne({ user: req.user.id }).populate("items.product");
    if (!cart || cart.items.length === 0) return res.status(400).json({ message: "Panier vide" });

    const shipping = await Shipping.findById(shippingZoneId);
    if (!shipping) return res.status(404).json({ message: "Zone de livraison introuvable" });

    const settings = await Settings.getSettings();
    const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingCost = subtotal >= shipping.isFreeAbove && shipping.isFreeAbove > 0 ? 0 : shipping.price;

    // Réduction nouveaux clients
    const eligibility = await checkNewCustomerEligibility(req.user.id, req.user.email, settings);
    const newCustomerDiscount = eligibility.eligible ? calcNewCustomerDiscount(subtotal, settings) : 0;
    const totalDiscount = (cart.couponDiscount || 0) + newCustomerDiscount;
    const total = subtotal - totalDiscount + shippingCost;

    const items = cart.items.map((i) => ({
      product: i.product._id,
      name: i.product.name.fr,
      image: i.product.images[0] || "",
      price: i.price,
      quantity: i.quantity,
      selectedVariants: i.selectedVariants,
    }));

    const order = await Order.create({
      user: req.user.id,
      items,
      shippingAddress,
      shippingZone: shippingZoneId,
      shippingCost,
      subtotal,
      couponDiscount: cart.couponDiscount || 0,
      newCustomerDiscount,
      total,
      paymentMethod,
      notes: (notes || "").slice(0, 500),
    });

    if (paymentMethod === "paydunya") {
      let invoice;
      try {
        invoice = await paydunya.createOrderInvoice(order, req.user);
      } catch (payErr) {
        logger.error("Erreur PayDunya invoice", { error: payErr.message, orderId: order._id });
        return res.status(502).json({ message: "Erreur de connexion au service de paiement" });
      }
      order.invoiceToken = invoice.token;
      await order.save();
      await Cart.findOneAndUpdate({ user: req.user.id }, { items: [], coupon: null, couponDiscount: 0 });
      if (cart.coupon) await Coupon.findByIdAndUpdate(cart.coupon, { $inc: { usedCount: 1 }, $push: { usedBy: req.user.id } });
      // Emails
      const userDoc = await User.findById(req.user.id).select("email firstName lastName");
      if (userDoc) {
        mailer.sendOrderConfirmation(userDoc.email, userDoc.firstName, order);
        mailer.sendAdminNewOrder(order, `${userDoc.firstName} ${userDoc.lastName}`, userDoc.email);
      }
      logger.info("Commande PayDunya créée", { orderId: order._id, userId: req.user.id });
      return res.status(201).json({ order, paymentUrl: invoice.url });
    }

    await Cart.findOneAndUpdate({ user: req.user.id }, { items: [], coupon: null, couponDiscount: 0 });
    if (cart.coupon) await Coupon.findByIdAndUpdate(cart.coupon, { $inc: { usedCount: 1 }, $push: { usedBy: req.user.id } });

    // Décrémenter le stock immédiatement pour COD
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity, sold: item.quantity } });
    }

    await Notification.create({ user: req.user.id, title: "Commande reçue", message: `Votre commande #${order.orderNumber} a été reçue`, type: "order", link: `/orders/${order._id}` });
    // Emails
    const userDoc = await User.findById(req.user.id).select("email firstName lastName");
    if (userDoc) {
      mailer.sendOrderConfirmation(userDoc.email, userDoc.firstName, order);
      mailer.sendAdminNewOrder(order, `${userDoc.firstName} ${userDoc.lastName}`, userDoc.email);
    }
    logger.info("Commande COD créée", { orderId: order._id, userId: req.user.id });
    res.status(201).json({ order });
  } catch (err) {
    logger.error("Erreur createOrder", { error: err.message, userId: req.user?.id });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.createGuestOrder = async (req, res) => {
  try {
    const {
      items, shippingAddress, shippingZoneId,
      paymentMethod = "cash_on_delivery",
      couponCode, notes, discretePackaging,
      firstName, lastName, email, phone,
    } = req.body;

    // Validation des champs obligatoires
    if (!firstName || !lastName) return res.status(400).json({ message: "Prénom et nom requis" });
    if (!email || !isValidEmail(email)) return res.status(400).json({ message: "Email invalide" });
    if (!phone || !isValidPhone(phone)) return res.status(400).json({ message: "Téléphone invalide" });
    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod))
      return res.status(400).json({ message: "Méthode de paiement invalide" });
    if (!isValidObjectId(shippingZoneId))
      return res.status(400).json({ message: "Zone de livraison invalide" });
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: "Panier vide" });
    if (items.length > 50)
      return res.status(400).json({ message: "Trop d'articles dans le panier" });

    const settings = await Settings.getSettings();

    let orderItems = [];
    let subtotal = 0;
    for (const item of items) {
      if (!isValidObjectId(item.productId))
        return res.status(400).json({ message: "ID produit invalide" });
      const qty = Math.max(1, Math.min(100, parseInt(item.quantity) || 1));
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) return res.status(404).json({ message: "Produit introuvable" });
      if (product.stock < qty) return res.status(400).json({ message: `Stock insuffisant pour ${product.name.fr}` });
      // Appliquer la majoration de prix si active
      const price = applyPriceBoost(product.price, settings);
      subtotal += price * qty;
      orderItems.push({
        product: product._id,
        name: product.name.fr,
        image: product.images[0] || "",
        price,
        quantity: qty,
        selectedVariants: Array.isArray(item.selectedVariants) ? item.selectedVariants.slice(0, 10) : [],
      });
    }

    const shipping = await Shipping.findById(shippingZoneId);
    if (!shipping) return res.status(404).json({ message: "Zone de livraison introuvable" });
    const shippingCost = subtotal >= shipping.isFreeAbove && shipping.isFreeAbove > 0 ? 0 : shipping.price;

    // Réduction nouveaux clients (guest)
    const guestEmail = String(email).toLowerCase().trim();
    const eligibility = await checkNewCustomerEligibility(null, guestEmail, settings);
    const newCustomerDiscount = eligibility.eligible ? calcNewCustomerDiscount(subtotal, settings) : 0;

    let couponDiscount = 0;
    let couponId = null;
    if (couponCode) {
      const code = String(couponCode).toUpperCase().trim().slice(0, 50);
      const coupon = await Coupon.findOne({ code, isActive: true });
      if (coupon &&
          (!coupon.expiresAt || coupon.expiresAt >= new Date()) &&
          (coupon.maxUses === 0 || coupon.usedCount < coupon.maxUses) &&
          subtotal >= coupon.minOrderAmount) {
        couponDiscount = coupon.type === "percentage"
          ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
        couponDiscount = Math.min(couponDiscount, subtotal);
        couponId = coupon._id;
      }
    }

    const total = subtotal - couponDiscount - newCustomerDiscount + shippingCost;

    const order = await Order.create({
      guestInfo: {
        firstName: String(firstName).slice(0, 100),
        lastName: String(lastName).slice(0, 100),
        email: String(email).toLowerCase().trim(),
        phone: String(phone).slice(0, 20),
      },
      items: orderItems,
      shippingAddress: {
        street: String(shippingAddress?.street || "").slice(0, 200),
        city: String(shippingAddress?.city || "").slice(0, 100),
        region: String(shippingAddress?.region || shippingAddress?.city || "").slice(0, 100),
        country: "Sénégal",
        phone: String(phone).slice(0, 20),
      },
      shippingZone: shippingZoneId,
      shippingCost,
      subtotal,
      couponDiscount,
      newCustomerDiscount,
      total,
      paymentMethod,
      notes: (notes || "").slice(0, 500),
      discretePackaging: !!discretePackaging,
    });

    if (couponId) await Coupon.findByIdAndUpdate(couponId, { $inc: { usedCount: 1 } });

    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity, sold: item.quantity } });
    }

    if (paymentMethod === "paydunya") {
      const guestUser = { firstName, lastName, email, phone, _id: order._id };
      try {
        const invoice = await paydunya.createOrderInvoice(order, guestUser);
        order.invoiceToken = invoice.token;
        await order.save();
        mailer.sendOrderConfirmation(email, firstName, order);
        mailer.sendAdminNewOrder(order, `${firstName} ${lastName}`, email);
        logger.info("Commande guest PayDunya créée", { orderId: order._id, email });
        return res.status(201).json({ order, paymentUrl: invoice.url });
      } catch (payErr) {
        logger.error("Erreur PayDunya guest", { error: payErr.message });
        return res.status(502).json({ message: "Erreur de connexion au service de paiement" });
      }
    }

    mailer.sendOrderConfirmation(email, firstName, order);
    mailer.sendAdminNewOrder(order, `${firstName} ${lastName}`, email);
    logger.info("Commande guest COD créée", { orderId: order._id, email });
    res.status(201).json({ order });
  } catch (err) {
    logger.error("Erreur createGuestOrder", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.ipnCallback = async (req, res) => {
  try {
    let body = req.body;
    // Le body peut être un Buffer si raw mode
    if (Buffer.isBuffer(body)) {
      try { body = JSON.parse(body.toString()); } catch { return res.status(400).json({ message: "Corps invalide" }); }
    }

    const { token } = body || {};
    if (!token || typeof token !== "string" || token.length > 200) {
      return res.status(400).json({ message: "Token invalide" });
    }

    const order = await Order.findOne({ invoiceToken: token });
    if (!order) return res.status(404).json({ message: "Commande introuvable" });

    // Éviter le traitement en double
    if (order.paymentStatus === "paid") return res.json({ message: "OK" });

    const status = await paydunya.checkInvoiceStatus(token);
    if (status === "completed") {
      order.paymentStatus = "paid";
      order.status = "processing";
      await order.save();
      logger.info("Paiement IPN confirmé", { orderId: order._id, orderNumber: order.orderNumber });
      if (order.user) {
        await Notification.create({ user: order.user, title: "Paiement confirmé", message: `Votre commande #${order.orderNumber} est en cours de traitement`, type: "payment", link: `/orders/${order._id}` });
        const userDoc = await User.findById(order.user).select("email firstName lastName");
        if (userDoc) mailer.sendOrderStatusUpdate(userDoc.email, userDoc.firstName, order);
      } else if (order.guestInfo?.email) {
        mailer.sendOrderStatusUpdate(order.guestInfo.email, order.guestInfo.firstName, order);
      }
    }
    res.json({ message: "OK" });
  } catch (err) {
    logger.error("Erreur IPN callback", { error: err.message });
    res.status(500).json({ message: "Erreur" });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 50);
    const [orders, total] = await Promise.all([
      Order.find({ user: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments({ user: req.user.id }),
    ]);
    res.json({ orders, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error("Erreur getMyOrders", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const order = await Order.findOne({ _id: req.params.id, user: req.user.id }).populate("shippingZone");
    if (!order) return res.status(404).json({ message: "Commande introuvable" });
    res.json(order);
  } catch (err) {
    logger.error("Erreur getOrderById", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getOrderByIdAdmin = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const order = await Order.findById(req.params.id)
      .populate("user", "firstName lastName email phone avatar")
      .populate("shippingZone", "name price");
    if (!order) return res.status(404).json({ message: "Commande introuvable" });
    res.json(order);
  } catch (err) {
    logger.error("Erreur getOrderByIdAdmin", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getAllOrdersAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 100);
    const { status, search } = req.query;
    const ALLOWED_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
    const filter = {};
    if (status && ALLOWED_STATUSES.includes(status)) filter.status = status;
    if (search) filter.orderNumber = safeRegex(search);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "firstName lastName email phone"),
      Order.countDocuments(filter),
    ]);
    res.json({ orders, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error("Erreur getAllOrdersAdmin", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "ID invalide" });
    const ALLOWED_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
    const { status, trackingNumber } = req.body;
    if (!ALLOWED_STATUSES.includes(status))
      return res.status(400).json({ message: "Statut invalide" });
    const update = { status };
    if (trackingNumber) update.trackingNumber = String(trackingNumber).slice(0, 100);
    if (status === "delivered") update.deliveredAt = new Date();
    if (status === "cancelled") {
      update.cancelledAt = new Date();
      update.cancelReason = String(req.body.cancelReason || "").slice(0, 500);
    }
    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true }).populate("user", "firstName lastName email");
    if (!order) return res.status(404).json({ message: "Commande introuvable" });
    if (order.user) {
      await Notification.create({ user: order.user._id, title: "Statut commande mis à jour", message: `Commande #${order.orderNumber} : ${status}`, type: "order", link: `/orders/${order._id}` });
      mailer.sendOrderStatusUpdate(order.user.email, order.user.firstName, order);
    } else if (order.guestInfo?.email) {
      mailer.sendOrderStatusUpdate(order.guestInfo.email, order.guestInfo.firstName, order);
    }
    logger.info("Statut commande mis à jour", { orderId: order._id, status, adminId: req.user.id });
    res.json(order);
  } catch (err) {
    logger.error("Erreur updateOrderStatus", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const [totalOrders, totalRevenue, pendingOrders, totalProducts] = await Promise.all([
      Order.countDocuments({ paymentStatus: "paid" }),
      Order.aggregate([{ $match: { paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
      Order.countDocuments({ status: "pending" }),
      require("../Models/Product").countDocuments({ isActive: true }),
    ]);
    res.json({ totalOrders, totalRevenue: totalRevenue[0]?.total || 0, pendingOrders, totalProducts });
  } catch (err) {
    logger.error("Erreur getAdminStats", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};
