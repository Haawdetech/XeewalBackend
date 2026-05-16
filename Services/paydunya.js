const axios = require("axios");
const { decryptKey } = require("../utils/cryptoKeys");

const BASE_URL =
  process.env.PAYDUNYA_MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

/* Les clés sont chiffrées en AES-256-GCM dans le .env */
function getHeaders() {
  return {
    "PAYDUNYA-MASTER-KEY":  decryptKey(process.env.PAYDUNYA_MASTER_KEY),
    "PAYDUNYA-PRIVATE-KEY": decryptKey(process.env.PAYDUNYA_PRIVATE_KEY),
    "PAYDUNYA-TOKEN":       decryptKey(process.env.PAYDUNYA_TOKEN),
    "Content-Type": "application/json",
  };
}

exports.createOrderInvoice = async (order, user) => {
  const payload = {
    invoice: {
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        description: item.selectedVariants?.map((v) => `${v.name}: ${v.value}`).join(", ") || "",
      })),
      taxes: [],
      total_amount: order.total,
      description: `Commande Xeewal #${order.orderNumber}`,
    },
    store: {
      name: "Xeewal",
      tagline: "Le choix smart, la vie en toute dignité",
      phone: process.env.STORE_PHONE || "221771234567",
      postal_address: "Dakar, Sénégal",
      logo_url: `${process.env.FRONTEND_URL}/logo.png`,
      website_url: process.env.FRONTEND_URL,
    },
    actions: {
      cancel_url: `${process.env.FRONTEND_URL}/checkout/cancel`,
      return_url: `${process.env.FRONTEND_URL}/checkout/success?order=${order._id}`,
      callback_url: `${process.env.BACKEND_URL}/api/orders/ipn`,
    },
    customer: {
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone || "",
    },
  };

  const response = await axios.post(`${BASE_URL}/checkout-invoice/create`, payload, { headers: getHeaders() });
  if (response.data.response_code !== "00") throw new Error(response.data.response_text || "Erreur PayDunya");
  // PayDunya live retourne l'URL dans response_text (pas invoice_url)
  const url = response.data.invoice_url || response.data.response_text;
  return { token: response.data.token, url };
};

exports.checkInvoiceStatus = async (token) => {
  const response = await axios.get(`${BASE_URL}/checkout-invoice/confirm/${token}`, { headers: getHeaders() });
  return response.data.status;
};
