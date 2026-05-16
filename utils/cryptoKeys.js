const crypto = require("crypto");
const ALGORITHM = "aes-256-gcm";

/**
 * Chiffre une valeur avec AES-256-GCM
 * Format de sortie : iv:authTag:ciphertext (hex)
 */
function encryptKey(text) {
  const key = Buffer.from(process.env.CRYPTO_SECRET, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let enc = cipher.update(text, "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + enc;
}

/**
 * Déchiffre une valeur chiffrée avec AES-256-GCM
 * Format attendu : iv:authTag:ciphertext (hex)
 */
function decryptKey(encryptedText) {
  if (!encryptedText) throw new Error("Clé manquante dans les variables d'environnement");
  const key = Buffer.from(process.env.CRYPTO_SECRET, "hex");
  const [ivHex, tagHex, enc] = encryptedText.split(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let dec = decipher.update(enc, "hex", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

module.exports = { encryptKey, decryptKey };
