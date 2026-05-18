const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

const createTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("Variables SMTP manquantes");
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
};

const FROM = `"Xeewal" <${process.env.SMTP_USER}>`;

const base = (content) => `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#FAF6EE;font-family:'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:600px;margin:0 auto;padding:32px 16px}
  .card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)}
  .header{background:#1B3D2F;padding:28px 36px;text-align:center}
  .header h1{color:#FAF6EE;font-size:22px;font-weight:900;margin:0;letter-spacing:2px}
  .header p{color:rgba(245,241,234,0.65);font-size:12px;margin:4px 0 0}
  .body{padding:36px}
  .body h2{color:#1B3D2F;font-size:18px;font-weight:800;margin:0 0 12px}
  .body p{color:#4B4B4B;font-size:14px;line-height:1.7;margin:0 0 12px}
  .btn{display:inline-block;background:#1B3D2F;color:#FAF6EE!important;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;margin:8px 0 20px}
  .table{width:100%;border-collapse:collapse;margin:16px 0}
  .table th{background:#F1E9D8;color:#1B3D2F;font-size:12px;font-weight:700;text-align:left;padding:10px 14px;text-transform:uppercase;letter-spacing:1px}
  .table td{padding:10px 14px;font-size:13px;color:#333;border-bottom:1px solid #F1E9D8}
  .badge{display:inline-block;background:#F1E9D8;color:#1B3D2F;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px}
  .total-row td{font-weight:800;font-size:15px;color:#1B3D2F;border-bottom:none;padding-top:14px}
  .footer{background:#F5F1EA;padding:20px 36px;text-align:center}
  .footer p{color:#9B9385;font-size:11px;margin:0;line-height:1.6}
  .divider{height:1px;background:#EFE9DC;margin:20px 0}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
  .info-box{background:#F5F1EA;border-radius:8px;padding:14px}
  .info-box .label{font-size:11px;color:#9B9385;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .info-box .value{font-size:13px;color:#1A1A1A;font-weight:600}
  .status-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="header">
      <h1>XEEWAL</h1>
      <p>Votre boutique discrète au Sénégal</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Xeewal · Dakar, Sénégal</p>
      <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
    </div>
  </div>
</div>
</body>
</html>`;

const formatPrice = (n) => `${Number(n).toLocaleString("fr-SN")} FCFA`;

const statusLabel = (s) => ({
  pending:    { label: "En attente",     color: "#F59E0B", bg: "#FEF3C7" },
  processing: { label: "En traitement",  color: "#3B82F6", bg: "#EFF6FF" },
  shipped:    { label: "Expédié",        color: "#8B5CF6", bg: "#EDE9FE" },
  delivered:  { label: "Livré",          color: "#10B981", bg: "#D1FAE5" },
  cancelled:  { label: "Annulé",         color: "#EF4444", bg: "#FEE2E2" },
}[s] || { label: s, color: "#6B7280", bg: "#F3F4F6" });

async function send(to, subject, html) {
  try {
    const t = createTransport();
    const info = await t.sendMail({ from: FROM, to, subject, html });
    logger.info("Email envoyé", { to, subject, messageId: info.messageId });
  } catch (err) {
    logger.error("Erreur envoi email", { to, subject, error: err.message, code: err.code });
  }
}

/* ── Reset password ─────────────────────────────────── */
exports.sendPasswordReset = (to, firstName, resetUrl) =>
  send(to, "Réinitialisation de votre mot de passe — Xeewal", base(`
    <h2>Réinitialiser votre mot de passe</h2>
    <p>Bonjour <strong>${firstName}</strong>,</p>
    <p>Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Xeewal. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
    <div style="text-align:center;margin:28px 0">
      <a href="${resetUrl}" class="btn">Réinitialiser mon mot de passe</a>
    </div>
    <p style="font-size:13px;color:#9B9385">Ce lien est valable <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    <div class="divider"></div>
    <p style="font-size:12px;color:#B5AC9B">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><span style="color:#1B3D2F;word-break:break-all">${resetUrl}</span></p>
  `));

/* ── Order confirmation (client) ────────────────────── */
exports.sendOrderConfirmation = (to, firstName, order) => {
  const items = order.items.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">${formatPrice(i.price * i.quantity)}</td>
    </tr>`).join("");

  const st = statusLabel(order.status);

  return send(to, `Confirmation de commande #${order.orderNumber} — Xeewal`, base(`
    <h2>Merci pour votre commande !</h2>
    <p>Bonjour <strong>${firstName}</strong>,</p>
    <p>Votre commande a bien été reçue et est en cours de traitement. Voici le récapitulatif :</p>

    <div class="info-grid">
      <div class="info-box">
        <div class="label">N° Commande</div>
        <div class="value">#${order.orderNumber}</div>
      </div>
      <div class="info-box">
        <div class="label">Statut</div>
        <div class="value">
          <span class="status-badge" style="background:${st.bg};color:${st.color}">${st.label}</span>
        </div>
      </div>
      <div class="info-box">
        <div class="label">Mode de paiement</div>
        <div class="value">${order.paymentMethod === "cash_on_delivery" ? "Paiement à la livraison" : "PayDunya"}</div>
      </div>
      <div class="info-box">
        <div class="label">Date</div>
        <div class="value">${new Date(order.createdAt).toLocaleDateString("fr-SN", { day: "2-digit", month: "long", year: "numeric" })}</div>
      </div>
    </div>

    <table class="table">
      <thead><tr><th>Produit</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix</th></tr></thead>
      <tbody>
        ${items}
        <tr><td colspan="3" style="padding:8px 0"></td></tr>
        ${order.shippingCost > 0 ? `<tr><td colspan="2" style="text-align:right;color:#6B6B6B;font-size:13px">Livraison</td><td style="text-align:right">${formatPrice(order.shippingCost)}</td></tr>` : `<tr><td colspan="2" style="text-align:right;color:#10B981;font-size:13px">Livraison</td><td style="text-align:right;color:#10B981">Gratuite</td></tr>`}
        ${order.couponDiscount > 0 ? `<tr><td colspan="2" style="text-align:right;color:#C8A55A;font-size:13px">Réduction</td><td style="text-align:right;color:#C8A55A">−${formatPrice(order.couponDiscount)}</td></tr>` : ""}
        <tr class="total-row"><td colspan="2" style="text-align:right">Total</td><td style="text-align:right">${formatPrice(order.total)}</td></tr>
      </tbody>
    </table>

    <div class="divider"></div>
    <p style="font-size:13px;color:#6B6B6B"><strong>Adresse de livraison :</strong><br>
      ${order.shippingAddress?.street || ""}${order.shippingAddress?.city ? ", " + order.shippingAddress.city : ""}${order.shippingAddress?.region ? ", " + order.shippingAddress.region : ""}, Sénégal
    </p>
    <p style="font-size:13px;color:#9B9385;margin-top:16px">📦 Livraison discrète garantie. Vous recevrez un email dès que votre colis est expédié.</p>
  `));
};

/* ── New order alert (admin) ────────────────────────── */
exports.sendAdminNewOrder = (order, clientName, clientEmail) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  // Support multiple emails separated by commas
  const recipients = adminEmail.split(",").map(e => e.trim()).filter(Boolean);
  if (recipients.length === 0) return;

  const items = order.items.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">${formatPrice(i.price * i.quantity)}</td>
    </tr>`).join("");

  const subject = `🛒 Nouvelle commande #${order.orderNumber} — ${formatPrice(order.total)}`;
  const html = base(`
    <h2>Nouvelle commande reçue !</h2>
    <p>Une nouvelle commande vient d'être passée sur Xeewal.</p>

    <div class="info-grid">
      <div class="info-box">
        <div class="label">N° Commande</div>
        <div class="value">#${order.orderNumber}</div>
      </div>
      <div class="info-box">
        <div class="label">Total</div>
        <div class="value" style="color:#1B3D2F;font-size:16px">${formatPrice(order.total)}</div>
      </div>
      <div class="info-box">
        <div class="label">Client</div>
        <div class="value">${clientName}</div>
      </div>
      <div class="info-box">
        <div class="label">Email</div>
        <div class="value" style="word-break:break-all">${clientEmail}</div>
      </div>
    </div>

    <table class="table">
      <thead><tr><th>Produit</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix</th></tr></thead>
      <tbody>
        ${items}
        <tr class="total-row"><td colspan="2" style="text-align:right">Total</td><td style="text-align:right">${formatPrice(order.total)}</td></tr>
      </tbody>
    </table>

    <div style="text-align:center;margin:24px 0">
      <a href="${process.env.FRONTEND_URL}/${process.env.ADMIN_LOCALE || "fr"}/admin/orders" class="btn">Voir dans l'administration →</a>
    </div>
  `);

  return Promise.all(recipients.map(to => send(to, subject, html)));
};

/* ── Order status update (client) ───────────────────── */
exports.sendOrderStatusUpdate = (to, firstName, order) => {
  const st = statusLabel(order.status);
  const messages = {
    processing: "Votre paiement a été confirmé. Votre commande est en cours de préparation.",
    shipped:    `Votre commande est en route ! ${order.trackingNumber ? `Numéro de suivi : <strong>${order.trackingNumber}</strong>` : "Elle sera livrée prochainement."}`,
    delivered:  "Votre commande a bien été livrée. Nous espérons que vous êtes satisfait(e) de vos achats !",
    cancelled:  `Votre commande a été annulée.${order.cancelReason ? " Raison : " + order.cancelReason : ""}`,
  };
  const msg = messages[order.status] || `Le statut de votre commande est maintenant : ${st.label}`;

  return send(to, `Mise à jour commande #${order.orderNumber} — ${st.label}`, base(`
    <h2>Mise à jour de votre commande</h2>
    <p>Bonjour <strong>${firstName}</strong>,</p>

    <div style="background:${st.bg};border-radius:10px;padding:16px 20px;margin:20px 0;display:flex;align-items:center;gap:12px">
      <span class="status-badge" style="background:${st.bg};color:${st.color};font-size:14px;border:1.5px solid ${st.color}">${st.label}</span>
      <span style="font-size:14px;color:#333">${msg}</span>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <div class="label">N° Commande</div>
        <div class="value">#${order.orderNumber}</div>
      </div>
      <div class="info-box">
        <div class="label">Total</div>
        <div class="value">${formatPrice(order.total)}</div>
      </div>
    </div>

    ${order.status === "delivered" ? `
    <div style="background:#F0FDF4;border-radius:10px;padding:16px 20px;margin:16px 0;border:1px solid #86EFAC">
      <p style="margin:0;font-size:13px;color:#166534">⭐ Vous avez reçu votre commande ? Partagez votre avis sur Xeewal !</p>
    </div>` : ""}
  `));
};
