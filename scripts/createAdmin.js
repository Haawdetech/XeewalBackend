require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ADMIN_EMAIL = "admin@xeewal.com";
const ADMIN_PASSWORD = "Xeewal@Admin2025";

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const User = require("../Models/User");

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    if (existing.role !== "admin") {
      await User.updateOne({ email: ADMIN_EMAIL }, { role: "admin" });
      console.log(`✅ Compte mis à jour en admin : ${ADMIN_EMAIL}`);
    } else {
      console.log(`ℹ️  Admin existe déjà : ${ADMIN_EMAIL}`);
    }
    await mongoose.disconnect();
    return;
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.create({
    firstName: "Admin",
    lastName: "Xeewal",
    email: ADMIN_EMAIL,
    password: hash,
    role: "admin",
    isEmailVerified: true,
  });

  console.log("✅ Compte admin créé avec succès !");
  console.log(`   Email    : ${ADMIN_EMAIL}`);
  console.log(`   Mot de passe : ${ADMIN_PASSWORD}`);
  await mongoose.disconnect();
}

createAdmin().catch((err) => { console.error(err); process.exit(1); });
