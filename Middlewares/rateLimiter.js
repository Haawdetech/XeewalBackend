const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

const getIp = (req) => req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de requêtes, veuillez réessayer plus tard." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Trop de tentatives de connexion, réessayez dans 15 minutes." },
  handler: (req, res) => {
    logger.warn("Rate limit AUTH dépassé", { ip: getIp(req), path: req.path, body: req.body?.email || "" });
    res.status(429).json({ message: "Trop de tentatives de connexion, réessayez dans 15 minutes." });
  },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Trop de tentatives de paiement, veuillez patienter." },
  handler: (req, res) => {
    logger.warn("Rate limit PAIEMENT dépassé", { ip: getIp(req), path: req.path });
    res.status(429).json({ message: "Trop de tentatives de paiement, veuillez patienter." });
  },
});

// Webhook IPN : 30 requêtes/minute max (PayDunya uniquement)
const ipnLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Trop de requêtes IPN." },
});

// Recherche publique : 60/minute
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: "Trop de requêtes de recherche, veuillez patienter." },
});

// Coupon validation publique : 20/minute
const couponLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: "Trop de tentatives de validation de coupon." },
});

// Actions admin sensibles : 30/minute
const adminWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Trop de requêtes admin, veuillez patienter." },
});

// Reset password : 5 tentatives / heure
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Trop de demandes de réinitialisation, réessayez dans 1 heure." },
});

module.exports = { globalLimiter, authLimiter, paymentLimiter, ipnLimiter, searchLimiter, couponLimiter, adminWriteLimiter, resetLimiter };
