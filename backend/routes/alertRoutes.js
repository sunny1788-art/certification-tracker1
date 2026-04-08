const express = require("express");
const Certification = require("../models/Certification");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/expiring", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + days);

    const certifications = await Certification.find({
      expiryDate: {
        $gte: today,
        $lte: targetDate
      }
    })
      .populate("user")
      .sort({ expiryDate: 1 });

    return res.json({
      alerts: certifications.map((certification) => certification.toCard()),
      message: `Found ${certifications.length} certifications expiring in the next ${days} days.`
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch expiry alerts.", details: error.message });
  }
});

module.exports = router;
