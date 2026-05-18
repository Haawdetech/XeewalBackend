require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize").sanitize;
const connectDB = require("./Config/DB");
const { globalLimiter } = require("./Middlewares/rateLimiter");
const routes = require("./Routes/index");
const logger = require("./utils/logger");

const app = express();

// DB
connectDB();

// ── Sécurité ────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: "deny" },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// Sanitisation NoSQL (body + params uniquement, req.query est read-only sur Express 5)
app.use((req, res, next) => {
  if (req.body) mongoSanitize(req.body, { allowDots: true });
  next();
});

// Rate limiting global
//app.use(globalLimiter);

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_WWW,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error("CORS non autorisé"));
    },
    credentials: true,
  })
);

// ── Logging HTTP ─────────────────────────────────────────────────────────────
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.originalUrl === "/health",
  })
);

// ── Body parsing ─────────────────────────────────────────────────────────────
// Body brut pour le webhook IPN (vérification de signature ultérieure)
app.use((req, res, next) => {
  if (req.originalUrl === "/api/orders/ipn") {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    express.json({ limit: "2mb" })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", routes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", app: "Xeewal API" }));

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: "Route introuvable" }));

// ── Gestionnaire d'erreurs global ────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error("Erreur non gérée", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });
  res.status(500).json({ message: "Une erreur est survenue. Veuillez réessayer." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Xeewal API démarré sur le port ${PORT}`));
