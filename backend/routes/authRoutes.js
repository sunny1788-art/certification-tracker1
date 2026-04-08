const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");
const { sendOtpEmail, sendSignupVerificationEmail, sendPhoneOtp, hasMailConfig } = require("../services/mailService");

const router = express.Router();

function signToken(user) {
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role
    },
    jwtSecret,
    {
      expiresIn: "7d"
    }
  );
}

function createOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

async function issueSignupOtps(user) {
  const emailOtp = createOtp();
  const phoneOtp = user.phone ? createOtp() : "";
  user.signupEmailOtp = emailOtp;
  user.signupPhoneOtp = phoneOtp;
  user.signupOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();

  const deliveries = [];
  deliveries.push(await sendSignupVerificationEmail({
    to: user.email,
    name: user.name,
    otp: emailOtp
  }));

  if (user.phone) {
    deliveries.push(await sendPhoneOtp({
      phone: user.phone,
      otp: phoneOtp
    }));
  }

  return deliveries;
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
    const expectedAdminCode = String(process.env.ADMIN_REGISTRATION_CODE || "").trim();
    if (requestedRole === "admin" && String(adminCode || "").trim() !== expectedAdminCode) {
      return res.status(403).json({ message: "Invalid admin registration code." });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: requestedRole,
      department: department || "General",
      phone: phone || "",
      emailVerified: false,
      phoneVerified: !phone,
      verificationPending: true
    });

    await issueSignupOtps(user);

    return res.status(201).json({
      message: "Signup successful. Verify your email and mobile OTP to activate the account.",
      verificationRequired: true,
      email: user.email,
      phone: user.phone,
      requiresPhoneOtp: Boolean(user.phone)
    });
  } catch (error) {
    return res.status(500).json({ message: "Signup failed.", details: error.message });
  }
});

router.post("/signup/resend-otp", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const channel = String(req.body.channel || "all").toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    user.signupOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    if (channel === "email" || channel === "all") {
      user.signupEmailOtp = createOtp();
      await sendSignupVerificationEmail({
        to: user.email,
        name: user.name,
        otp: user.signupEmailOtp
      });
    }
    if ((channel === "phone" || channel === "all") && user.phone) {
      user.signupPhoneOtp = createOtp();
      await sendPhoneOtp({
        phone: user.phone,
        otp: user.signupPhoneOtp
      });
    }
    await user.save();

    return res.json({
      message: "Verification OTP resent successfully.",
      requiresPhoneOtp: Boolean(user.phone)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to resend signup OTP.", details: error.message });
  }
});

router.post("/signup/verify", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const emailOtp = String(req.body.emailOtp || "").trim();
    const phoneOtp = String(req.body.phoneOtp || "").trim();

    if (!email || !emailOtp) {
      return res.status(400).json({ message: "Email and email OTP are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Account not found." });
    }

    if (!user.signupOtpExpiresAt || user.signupOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "Signup OTP expired. Please resend OTP." });
    }

    if (user.signupEmailOtp !== emailOtp) {
      return res.status(400).json({ message: "Invalid email OTP." });
    }

    if (user.phone && user.signupPhoneOtp !== phoneOtp) {
      return res.status(400).json({ message: "Invalid mobile OTP." });
    }

    user.emailVerified = true;
    user.phoneVerified = user.phone ? true : user.phoneVerified;
    user.verificationPending = false;
    user.signupEmailOtp = "";
    user.signupPhoneOtp = "";
    user.signupOtpExpiresAt = null;
    await user.save();

    return res.json({
      message: "Signup verification successful.",
      token: signToken(user),
      user: user.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify signup.", details: error.message });
  }
});

router.post("/mobile-otp/send", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user || !user.phone) {
      return res.status(404).json({ message: "No verified phone record found for this account." });
    }

    user.signupPhoneOtp = createOtp();
    user.signupOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendPhoneOtp({ phone: user.phone, otp: user.signupPhoneOtp });

    return res.json({ message: "Mobile OTP sent successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to send mobile OTP.", details: error.message });
  }
});

router.post("/mobile-otp/verify", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const otp = String(req.body.otp || "").trim();
    const user = await User.findOne({ email });
    if (!user || !user.phone) {
      return res.status(404).json({ message: "Account with phone verification not found." });
    }

    if (!otp || user.signupPhoneOtp !== otp) {
      return res.status(400).json({ message: "Invalid mobile OTP." });
    }

    user.phoneVerified = true;
    user.signupPhoneOtp = "";
    user.verificationPending = !user.emailVerified;
    await user.save();

    return res.json({
      message: "Mobile verification successful.",
      user: user.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify mobile OTP.", details: error.message });
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
      return res.status(403).json({ message: user.blockedReason || "This account is inactive. Please contact the admin." });
    }
    if (user.verificationPending === true || user.emailVerified === false || (user.phone && user.phoneVerified === false)) {
      return res.status(403).json({ message: "Complete email and mobile verification before login." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 3) {
        user.suspiciousScore = Math.max(Number(user.suspiciousScore || 0), user.failedLoginAttempts);
        user.suspiciousReason = "Repeated failed login attempts detected.";
      }
      await user.save();
      return res.status(401).json({ message: "Invalid email or password." });
    }

    user.failedLoginAttempts = 0;
    user.loginCount = Number(user.loginCount || 0) + 1;
    user.lastLoginAt = new Date();
    await user.save();

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
