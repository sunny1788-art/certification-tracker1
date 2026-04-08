const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const jwtSecret = String(process.env.JWT_SECRET || "").trim();

    if (!token) {
      return res.status(401).json({ message: "Authentication token is missing." });
    }

    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User is not authorized." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission for this action." });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
