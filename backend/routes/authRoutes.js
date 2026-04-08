const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { sendOtpEmail, hasMailConfig } = require("../services/mailService");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, department, phone, adminCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const requestedRole = role === "admin" ? "admin" : "student";
    if (requestedRole === "admin" && adminCode !== process.env.ADMIN_REGISTRATION_CODE) {
      return res.status(403).json({ message: "Invalid admin registration code." });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: requestedRole,
      department: department || "General",
      phone: phone || ""
    });

    return res.status(201).json({
      message: "Registration successful.",
      token: signToken(user),
      user: user.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ message: "Signup failed.", details: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "This account is inactive. Please contact the admin." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.json({
      message: "Login successful.",
      token: signToken(user),
      user: user.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed.", details: error.message });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    user.resetOtpCode = otp;
    user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const delivery = await sendOtpEmail({
      to: user.email,
      name: user.name,
      otp
    });

    return res.json({
      message: delivery.delivered
        ? "OTP sent to your email successfully."
        : "OTP generated. Email delivery is not configured yet, so check the server console preview.",
      mailConfigured: hasMailConfig()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to send OTP.", details: error.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long." });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetOtpCode || !user.resetOtpExpiresAt) {
      return res.status(400).json({ message: "No valid OTP request found." });
    }

    if (user.resetOtpCode !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (user.resetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    user.password = newPassword;
    user.resetOtpCode = "";
    user.resetOtpExpiresAt = null;
    await user.save();

    return res.json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reset password.", details: error.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({
    user: req.user.toSafeObject()
  });
});

module.exports = router;
