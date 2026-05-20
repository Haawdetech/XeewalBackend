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

  if (userId) {
    ordersCount = await Order.countDocuments({ user: userId });
  } else if (email) {
    ordersCount = await Order.countDocuments({
      $or: [
        { "guestInfo.email": email.toLowerCase() },
        { guestEmail: email.toLowerCase() },
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

module.exports = { applyPriceBoost, checkNewCustomerEligibility, calcNewCustomerDiscount };
