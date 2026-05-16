const mongoose = require("mongoose");

/** Échappe les caractères spéciaux RegExp pour éviter l'injection */
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Retourne un RegExp sécurisé case-insensitive */
function safeRegex(str) {
  return new RegExp(escapeRegExp(str), "i");
}

/** Valide qu'un ID est un ObjectId Mongo valide */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/** Normalise la pagination et plafonne le limit */
function parsePagination(query, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/** Valide un email basique */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

/** Valide un numéro de téléphone (min 8 chiffres) */
function isValidPhone(phone) {
  return /^\+?[\d\s\-]{8,20}$/.test(String(phone));
}

/** Essaie JSON.parse et retourne null si erreur */
function safeJsonParse(str, fallback = null) {
  try {
    const result = JSON.parse(str);
    return result;
  } catch {
    return fallback;
  }
}

module.exports = { escapeRegExp, safeRegex, isValidObjectId, parsePagination, isValidEmail, isValidPhone, safeJsonParse };
