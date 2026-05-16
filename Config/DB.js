const mongoose = require("mongoose");
const { decryptKey } = require("../utils/cryptoKeys");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const uri = decryptKey(process.env.MONGO_URI);
    await mongoose.connect(uri);
    logger.info("MongoDB connecté");
  } catch (error) {
    logger.error("Erreur MongoDB connexion", { error: error.message });
    process.exit(1);
  }
};

module.exports = connectDB;
