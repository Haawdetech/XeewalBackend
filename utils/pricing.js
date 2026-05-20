const Order = require("../Models/Order");
const Settings = require("../Models/Settings");

/**
 * Applique la majoration de prix si active
 * @param {number} price - prix original
 * @param {object} settings - objet settings
 */
const applyPriceBoost = (price, settings) => {
  if (!settings?.priceBoost?.active) return price;
  return Math.round(price * (1 + settings.priceBoost.percent / 100));
};

/**
 * Vérifie si un utilisateur/email est éligible à la réduction nouveaux clients
 * @param {string|null} userId - ID utilisateur connecté (ou null)
 * @param {string|null} email - email (pour les guests)
 * @param {object} settings - objet settings
 */
const checkNewCustomerEligibility = async (userId, email, settings) => {
  if (!settings?.newCustomerDiscount?.active) {
    return { eligible: false, ordersCount: 0, remaining: 0 };
  }

  const maxOrders = settings.newCustomerDiscount.maxOrders || 3;
  let ordersCount = 0;

  // On exclut uniquement les commandes annulées
  // (les commandes cash-on-delivery sont pending jusqu'à livraison → elles comptent quand même)
  const notCancelled = { status: { $ne: "cancelled" } };

  if (userId) {
    ordersCount = await Order.countDocuments({ user: userId, ...notCancelled });
  } else if (email) {
    ordersCount = await Order.countDocuments({
      $and: [
        {
          $or: [
            { "guestInfo.email": email.toLowerCase() },
            { guestEmail: email.toLowerCase() },
          ],
        },
        notCancelled,
      ],
    });
  }

  const eligible = ordersCount < maxOrders;
  return {
    eligible,
    ordersCount,
    remaining: Math.max(0, maxOrders - ordersCount),
  };
};

/**
 * Calcule le montant de la réduction nouveaux clients
 * @param {number} subtotal - sous-total avant réduction
 * @param {object} settings
 */
const calcNewCustomerDiscount = (subtotal, settings) => {
  if (!settings?.newCustomerDiscount?.active) return 0;
  return Math.round((subtotal * settings.newCustomerDiscount.percent) / 100);
};

/**
 * Trouve la promo applicable pour un produit parmi une liste de promos actives.
 * Priorité : global > catégorie
 */
const getActivePromoForProduct = (product, promotions = []) => {
  const global = promotions.find(p => p.type === "global");
  if (global) return global;
  const catId = (product.category?._id || product.category)?.toString();
  return promotions.find(p => p.type === "category" && p.categoryId?.toString() === catId) || null;
};

/**
 * Applique une promo sur un prix
 */
const applyPromo = (price, promo) => {
  if (!promo) return price;
  const raw = price * (1 - promo.percent / 100);
  return Math.ceil(raw / 100) * 100; // arrondi à la centaine supérieure
};

module.exports = {
  applyPriceBoost,
  checkNewCustomerEligibility,
  calcNewCustomerDiscount,
  getActivePromoForProduct,
  applyPromo,
};
