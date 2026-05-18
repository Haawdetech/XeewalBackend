/**
 * Test envoi email SMTP
 * node scripts/test-smtp.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const nodemailer = require("nodemailer");

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT) || 587;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const adminEmail = process.env.ADMIN_EMAIL;

console.log("── Config SMTP ──────────────────────");
console.log("SMTP_HOST   :", host || "❌ MANQUANT");
console.log("SMTP_PORT   :", port);
console.log("SMTP_USER   :", user || "❌ MANQUANT");
console.log("SMTP_PASS   :", pass ? "✅ défini" : "❌ MANQUANT");
console.log("ADMIN_EMAIL :", adminEmail || "❌ MANQUANT");
console.log("────────────────────────────────────\n");

if (!host || !user || !pass) {
  console.error("❌ Variables SMTP manquantes — arrêt.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  tls: { rejectUnauthorized: false },
});

(async () => {
  try {
    console.log("🔌 Test connexion SMTP...");
    await transporter.verify();
    console.log("✅ Connexion SMTP OK\n");

    if (!adminEmail) {
      console.warn("⚠️  ADMIN_EMAIL non défini — test d'envoi ignoré.");
      process.exit(0);
    }

    console.log(`📧 Envoi d'un email test à ${adminEmail}...`);
    const info = await transporter.sendMail({
      from: `"Xeewal Test" <${user}>`,
      to: adminEmail,
      subject: "✅ Test SMTP Xeewal",
      html: "<p>Si vous recevez cet email, le SMTP fonctionne correctement sur le serveur.</p>",
    });
    console.log("✅ Email envoyé ! MessageId :", info.messageId);
  } catch (err) {
    console.error("❌ Erreur SMTP :", err.message);
    console.error("   Code :", err.code);
    process.exit(1);
  }
})();
