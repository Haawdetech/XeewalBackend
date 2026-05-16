const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../Models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            user.googleId = profile.id;
            if (!user.avatar && profile.photos[0]?.value) user.avatar = profile.photos[0].value;
            await user.save();
          } else {
            user = await User.create({
              firstName: profile.name.givenName || profile.displayName,
              lastName: profile.name.familyName || "",
              email: profile.emails[0].value,
              googleId: profile.id,
              avatar: profile.photos[0]?.value || "",
              isEmailVerified: true,
            });
          }
        }
        if (user.isBlocked) return done(null, false, { message: "Compte bloqué" });
        user.lastLogin = new Date();
        await user.save();
        const token = jwt.sign(
          { id: user._id, role: user.role, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );
        return done(null, { user, token });
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
