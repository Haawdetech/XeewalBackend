/**
 * Crée un compte administrateur dans la base de données.
 * Usage : node scripts/create-admin.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { decryptKey } = require("../utils/cryptoKeys");
const User = require("../Models/User");

const ADMIN = {
  firstName: "Admin",
  lastName:  "Xeewal",
  email:     "admin@xeewal.com",   // ← change si besoin
  password:  "Xeewal@2025!",       // ← change si besoin (min 8 chars)
  role:      "admin",
};

async function main() {
  const uri = decryptKey(process.env.MONGO_URI);
  await mongoose.connect(uri);
  console.log("✅ MongoDB connecté");

  const exists = await User.findOne({ email: ADMIN.email });
  if (exists) {
    if (exists.role !== "admin") {
      exists.role = "admin";
      await exists.save();
      console.log(`ℹ️  Compte existant promu admin : ${ADMIN.email}`);
    } else {
      console.log(`ℹ️  Compte admin déjà existant : ${ADMIN.email}`);
    }
    await mongoose.disconnect();
    return;
  }

  const hashed = await bcrypt.hash(ADMIN.password, 12);
  await User.create({
    firstName: ADMIN.firstName,
    lastName:  ADMIN.lastName,
    email:     ADMIN.email,
    password:  hashed,
    role:      "admin",
  });

  console.log("🎉 Compte admin créé avec succès !");
  console.log(`   Email    : ${ADMIN.email}`);
  console.log(`   Password : ${ADMIN.password}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌ Erreur :", e.message);
  process.exit(1);
});
