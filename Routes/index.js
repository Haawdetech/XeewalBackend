const express = require("express");
const router = express.Router();

const { authenticateUser, adminRole } = require("../Middlewares/VerifyToken");
const { authLimiter, paymentLimiter, ipnLimiter, searchLimiter, couponLimiter, adminWriteLimiter } = require("../Middlewares/rateLimiter");
const { uploadProduct, uploadCategory, uploadAvatar } = require("../Middlewares/uploadS3");
const passport = require("../Middlewares/googlePassport");

const authCtrl = require("../Controllers/authController");
const productCtrl = require("../Controllers/productController");
const categoryCtrl = require("../Controllers/categoryController");
const cartCtrl = require("../Controllers/cartController");
const orderCtrl = require("../Controllers/orderController");
const shippingCtrl = require("../Controllers/shippingController");
const reviewCtrl = require("../Controllers/reviewController");
const couponCtrl = require("../Controllers/couponController");
const notifCtrl = require("../Controllers/notificationController");
const adminUserCtrl = require("../Controllers/adminUserController");

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post("/auth/register", authLimiter, authCtrl.register);
router.post("/auth/login", authLimiter, authCtrl.login);
router.get("/auth/me", authenticateUser, authCtrl.getMe);
router.put("/auth/profile", authenticateUser, ...uploadAvatar.single("avatar"), authCtrl.updateProfile);
router.put("/auth/password", authenticateUser, authLimiter, authCtrl.updatePassword);
router.post("/auth/address", authenticateUser, authCtrl.addAddress);
router.delete("/auth/address/:id", authenticateUser, authCtrl.deleteAddress);
router.get("/auth/wishlist", authenticateUser, authCtrl.getWishlist);
router.post("/auth/wishlist", authenticateUser, authCtrl.toggleWishlist);
router.put("/auth/change-password", authenticateUser, authLimiter, authCtrl.updatePassword);

// Google OAuth
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
router.get("/auth/google/callback", passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL}/auth/login?error=google` }), authCtrl.googleCallback);

// ── Categories ────────────────────────────────────────────────────────────────
router.get("/categories", categoryCtrl.getCategories);
router.get("/categories/:slug", categoryCtrl.getCategoryBySlug);
router.post("/admin/categories", authenticateUser, adminRole, adminWriteLimiter, ...uploadCategory.single("image"), categoryCtrl.createCategory);
router.put("/admin/categories/:id", authenticateUser, adminRole, adminWriteLimiter, ...uploadCategory.single("image"), categoryCtrl.updateCategory);
router.delete("/admin/categories/:id", authenticateUser, adminRole, adminWriteLimiter, categoryCtrl.deleteCategory);

// ── Products ──────────────────────────────────────────────────────────────────
router.get("/products", searchLimiter, productCtrl.getProducts);
router.get("/admin/products", authenticateUser, adminRole, productCtrl.getAllProductsAdmin);
router.get("/admin/products/:id", authenticateUser, adminRole, productCtrl.getProductById);
router.get("/products/:slug", productCtrl.getProductBySlug);
router.get("/products/:slug/related", productCtrl.getRelatedProducts);
router.post("/admin/products", authenticateUser, adminRole, adminWriteLimiter, ...uploadProduct.array("images", 8), productCtrl.createProduct);
router.put("/admin/products/:id", authenticateUser, adminRole, adminWriteLimiter, ...uploadProduct.array("images", 8), productCtrl.updateProduct);
router.delete("/admin/products/:id", authenticateUser, adminRole, adminWriteLimiter, productCtrl.deleteProduct);

// ── Cart ──────────────────────────────────────────────────────────────────────
router.get("/cart", authenticateUser, cartCtrl.getCart);
router.post("/cart", authenticateUser, cartCtrl.addToCart);
router.put("/cart/:itemId", authenticateUser, cartCtrl.updateCartItem);
router.delete("/cart/:itemId", authenticateUser, cartCtrl.removeFromCart);
router.delete("/cart", authenticateUser, cartCtrl.clearCart);
router.post("/cart/coupon", authenticateUser, couponLimiter, cartCtrl.applyCoupon);
router.delete("/cart/coupon", authenticateUser, cartCtrl.removeCoupon);

// Validation coupon publique (guests)
router.post("/coupons/validate", couponLimiter, couponCtrl.validateCoupon);

// ── Orders ────────────────────────────────────────────────────────────────────
router.post("/orders", authenticateUser, paymentLimiter, orderCtrl.createOrder);
router.post("/orders/ipn", ipnLimiter, orderCtrl.ipnCallback);
router.post("/orders/guest", paymentLimiter, orderCtrl.createGuestOrder);
router.get("/orders", authenticateUser, orderCtrl.getMyOrders);
router.get("/orders/:id", authenticateUser, orderCtrl.getOrderById);
router.get("/admin/orders", authenticateUser, adminRole, orderCtrl.getAllOrdersAdmin);
router.put("/admin/orders/:id/status", authenticateUser, adminRole, adminWriteLimiter, orderCtrl.updateOrderStatus);
router.get("/admin/stats", authenticateUser, adminRole, orderCtrl.getAdminStats);

// ── Shipping ──────────────────────────────────────────────────────────────────
router.get("/shipping", shippingCtrl.getShippingZones);
router.post("/admin/shipping", authenticateUser, adminRole, adminWriteLimiter, shippingCtrl.createShippingZone);
router.put("/admin/shipping/:id", authenticateUser, adminRole, adminWriteLimiter, shippingCtrl.updateShippingZone);
router.delete("/admin/shipping/:id", authenticateUser, adminRole, adminWriteLimiter, shippingCtrl.deleteShippingZone);

// ── Reviews ───────────────────────────────────────────────────────────────────
router.get("/reviews/:productId", reviewCtrl.getProductReviews);
router.post("/reviews", authenticateUser, reviewCtrl.createReview);
router.delete("/reviews/:id", authenticateUser, reviewCtrl.deleteReview);

// ── Coupons ───────────────────────────────────────────────────────────────────
router.get("/admin/coupons", authenticateUser, adminRole, couponCtrl.getCoupons);
router.post("/admin/coupons", authenticateUser, adminRole, adminWriteLimiter, couponCtrl.createCoupon);
router.put("/admin/coupons/:id", authenticateUser, adminRole, adminWriteLimiter, couponCtrl.updateCoupon);
router.delete("/admin/coupons/:id", authenticateUser, adminRole, adminWriteLimiter, couponCtrl.deleteCoupon);

// ── Admin Users ───────────────────────────────────────────────────────────────
router.get("/admin/users", authenticateUser, adminRole, adminUserCtrl.getUsers);
router.put("/admin/users/:id", authenticateUser, adminRole, adminWriteLimiter, adminUserCtrl.updateUser);
router.delete("/admin/users/:id", authenticateUser, adminRole, adminWriteLimiter, adminUserCtrl.deleteUser);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get("/notifications", authenticateUser, notifCtrl.getNotifications);
router.put("/notifications/mark-all-read", authenticateUser, notifCtrl.markAllRead);

module.exports = router;
