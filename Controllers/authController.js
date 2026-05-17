const User = require("../Models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getJwtSecret } = require("../Middlewares/VerifyToken");
const logger = require("../utils/logger");
const { isValidEmail } = require("../utils/validate");
const mailer = require("../Services/mailer");

const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, email: user.email }, getJwtSecret(), { expiresIn: "7d" });

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "Tous les champs obligatoires doivent être remplis" });
    if (!isValidEmail(email))
      return res.status(400).json({ message: "Format d'email invalide" });
    if (!password || password.length < 8)
      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères" });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ message: "Cet email est déjà utilisé" });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ firstName, lastName, email: email.toLowerCase().trim(), password: hashed, phone });
    const token = generateToken(user);
    logger.info("Nouvel utilisateur enregistré", { userId: user._id, email: user.email });
    res.status(201).json({ token, user: { id: user._id, firstName, lastName, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    logger.error("Erreur register", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email et mot de passe requis" });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
    if (!user) return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    if (user.isBlocked) return res.status(403).json({ message: "Compte bloqué, contactez le support" });
    if (!user.password) return res.status(401).json({ message: "Connectez-vous avec Google" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      logger.warn("Tentative de connexion échouée", { email, ip: req.ip });
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    user.lastLogin = new Date();
    await user.save();
    const token = generateToken(user);
    logger.info("Connexion réussie", { userId: user._id });
    res.json({ token, user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) {
    logger.error("Erreur login", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json(user);
  } catch (err) {
    logger.error("Erreur getMe", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const update = {};
    if (firstName) update.firstName = firstName;
    if (lastName) update.lastName = lastName;
    if (phone) update.phone = phone;
    if (req.file) update.avatar = req.file.location;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select("-password");
    res.json(user);
  } catch (err) {
    logger.error("Erreur updateProfile", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
    const user = await User.findById(req.user.id).select("+password");
    if (!user.password) return res.status(400).json({ message: "Compte Google, pas de mot de passe" });
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(401).json({ message: "Ancien mot de passe incorrect" });
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: "Mot de passe mis à jour" });
  } catch (err) {
    logger.error("Erreur updatePassword", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { label, street, city, region, country, isDefault } = req.body;
    if (!street || !city) return res.status(400).json({ message: "Rue et ville sont requis" });
    if (isDefault) user.addresses.forEach((a) => (a.isDefault = false));
    user.addresses.push({ label, street, city, region, country, isDefault });
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    logger.error("Erreur addAddress", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses = user.addresses.filter((a) => a._id.toString() !== req.params.id);
    await user.save();
    res.json(user.addresses);
  } catch (err) {
    logger.error("Erreur deleteAddress", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.toggleWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { productId } = req.body;
    const idx = user.wishlist.indexOf(productId);
    if (idx > -1) user.wishlist.splice(idx, 1);
    else user.wishlist.push(productId);
    await user.save();
    res.json({ wishlist: user.wishlist });
  } catch (err) {
    logger.error("Erreur toggleWishlist", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("wishlist");
    res.json(user.wishlist || []);
  } catch (err) {
    logger.error("Erreur getWishlist", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email))
      return res.status(400).json({ message: "Email invalide" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Réponse générique pour ne pas révéler si l'email existe
    if (!user || !user.password)
      return res.json({ message: "Si cet email existe, un lien de réinitialisation vous a été envoyé." });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 3600 * 1000); // 1h
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/fr/auth/reset-password?token=${token}`;
    await mailer.sendPasswordReset(user.email, user.firstName, resetUrl);
    logger.info("Reset password demandé", { userId: user._id });
    res.json({ message: "Si cet email existe, un lien de réinitialisation vous a été envoyé." });
  } catch (err) {
    logger.error("Erreur forgotPassword", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8)
      return res.status(400).json({ message: "Token et mot de passe (8 caractères min) requis" });

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user)
      return res.status(400).json({ message: "Lien invalide ou expiré. Faites une nouvelle demande." });

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    logger.info("Mot de passe réinitialisé", { userId: user._id });
    res.json({ message: "Mot de passe réinitialisé avec succès. Vous pouvez vous connecter." });
  } catch (err) {
    logger.error("Erreur resetPassword", { error: err.message });
    res.status(500).json({ message: "Une erreur est survenue" });
  }
};

// OAuth Google — le token est transmis via un code court dans l'URL,
// jamais le JWT directement (évite l'exposition dans les logs/historique)
exports.googleCallback = (req, res) => {
  const { token, user } = req.user;
  const frontendUrl = process.env.FRONTEND_URL;
  // On passe uniquement le rôle dans l'URL ; le token est dans un cookie httpOnly
  res.cookie("xeewal_oauth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
  });
  logger.info("OAuth Google callback", { userId: user._id });
  res.redirect(`${frontendUrl}/auth/google/success?role=${user.role}`);
};
