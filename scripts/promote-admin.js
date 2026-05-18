/**
 * Passe un compte existant en role "admin"
 * node scripts/promote-admin.js sammbasow1999@gmail.com
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../Models/User");

const email = process.argv[2];
if (!email) { console.error("Usage: node scripts/promote-admin.js <email>"); process.exit(1); }

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const user = await User.findOne({ email });
  if (!user) { console.error("❌ Utilisateur introuvable :", email); process.exit(1); }
  user.role = "admin";
  await user.save();
  console.log(`✅ ${email} est maintenant admin (id: ${user._id})`);
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
