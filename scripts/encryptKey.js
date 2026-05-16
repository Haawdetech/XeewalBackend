

require('dotenv').config();
const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';

/* ── Chiffrement ─────────────────────────────────────── */
function encrypt(text) {
  const key    = Buffer.from(process.env.CRYPTO_SECRET, 'hex');
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let enc      = cipher.update(String(text), 'utf8', 'hex');
  enc         += cipher.final('hex');
  const tag    = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + tag + ':' + enc;
}

/* ── Déchiffrement (vérif) ───────────────────────────── */
function decrypt(encryptedText) {
  const key = Buffer.from(process.env.CRYPTO_SECRET, 'hex');
  const [ivHex, tagHex, enc] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec  = decipher.update(enc, 'hex', 'utf8');
  dec     += decipher.final('utf8');
  return dec;
}

/* ── Génération de secret ────────────────────────────── */
if (process.argv[2] === '--generate-secret') {
  const secret = crypto.randomBytes(32).toString('hex');
  console.log('\n🔑 Nouveau CRYPTO_SECRET généré :');
  console.log('  ' + secret);
  console.log('\n➡  Ajoute cette ligne dans ton .env :');
  console.log('  CRYPTO_SECRET=' + secret);
  console.log('\n⚠️  Garde ce secret en sécurité. Sans lui, impossible de déchiffrer les clés.\n');
  process.exit(0);
}

/* ── Chiffrer une valeur ─────────────────────────────── */
const text = process.argv[2];

if (!text) {
  console.log('\n📖 Usage :');
  console.log('  node scripts/encryptKey.js "ta_clé_api"');
  console.log('\n🔑 Générer un CRYPTO_SECRET :');
  console.log('  node scripts/encryptKey.js --generate-secret\n');
  process.exit(1);
}

if (!process.env.CRYPTO_SECRET) {
  console.error('\n❌ CRYPTO_SECRET absent du .env');
  console.error('   Lance d\'abord : node scripts/encryptKey.js --generate-secret\n');
  process.exit(1);
}

if (process.env.CRYPTO_SECRET.length !== 64) {
  console.error('\n❌ CRYPTO_SECRET invalide (doit faire 64 caractères hex = 32 bytes)\n');
  process.exit(1);
}

const encrypted = encrypt(text);
const verified  = decrypt(encrypted);

console.log('\n✅ Chiffrement réussi (AES-256-GCM) :');
console.log('─'.repeat(60));
console.log('Original  :', text);
console.log('Chiffré   :', encrypted);
console.log('Vérif OK  :', verified === text ? '✓ identique' : '✗ ERREUR');
console.log('─'.repeat(60));
console.log('\n➡  Colle la valeur chiffrée dans ton .env\n');
