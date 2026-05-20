/**
 * Augmente tous les prix produits de 20% dans la DB
 * Usage : node scripts/boost-prices.js
 * Dry-run (voir sans modifier) : node scripts/boost-prices.js --dry
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const connectDB = require("../Config/DB");
const Product = require("../Models/Product");

const DRY_RUN = process.argv.includes("--dry");
const PERCENT = 20;

connectDB().then(async () => {
  const products = await Product.find({});
  console.log(`\n📦 ${products.length} produits trouvés\n`);

  let updated = 0;
  for (const p of products) {
    const oldPrice = p.price;
    const newPrice = Math.round(oldPrice * (1 + PERCENT / 100));
    const oldCompare = p.comparePrice || 0;
    const newCompare = oldCompare > 0 ? Math.round(oldCompare * (1 + PERCENT / 100)) : 0;

    console.log(`  ${p.name?.fr || p._id}`);
    console.log(`    prix      : ${oldPrice} → ${newPrice} FCFA`);
    if (oldCompare > 0) console.log(`    comparePrice : ${oldCompare} → ${newCompare} FCFA`);

    if (!DRY_RUN) {
      p.price = newPrice;
      if (oldCompare > 0) p.comparePrice = newCompare;
      await p.save();
      updated++;
    }
  }

  if (DRY_RUN) {
    console.log(`\n⚠️  DRY-RUN — aucune modification effectuée`);
    console.log(`   Relance sans --dry pour appliquer les changements\n`);
  } else {
    console.log(`\n✅ ${updated} produits mis à jour (+${PERCENT}%)\n`);
  }

  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
