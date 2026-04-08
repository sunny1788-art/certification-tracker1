const express = require("express");
const path = require("path");
const Certification = require("../models/Certification");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { buildSummary } = require("../utils/summary");

const router = express.Router();

function toCsv(rows) {
  const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(escapeCell).join(",")).join("\n");
}

function buildCertFilters(req) {
  if (req.user.role === "admin") {
    const filters = {};

    if (req.query.userId) {
      filters.user = req.query.userId;
    }

    return filters;
  }

  return { user: req.user._id };
}

function validationError(message, details) {
  const error = new Error(message);
  error.statusCode = 400;
  error.details = details;
  return error;
}

function parseCertificationPayload(req, existingCertification = null) {
  const source = req.body || {};

  const title = (source.title ?? existingCertification?.title ?? "").trim();
  const provider = (source.provider ?? existingCertification?.provider ?? "").trim();
  const certificateCode = (source.certificateCode ?? existingCertification?.certificateCode ?? "").trim();
  const renewalStatus = source.renewalStatus ?? existingCertification?.renewalStatus ?? "Not Started";
  const notes = source.notes ?? existingCertification?.notes ?? "";
  const reminderDaysValue = source.reminderDays ?? existingCertification?.reminderDays ?? 30;
  const issueDateValue = source.issueDate ?? existingCertification?.issueDate;
  const expiryDateValue = source.expiryDate ?? existingCertification?.expiryDate;

  if (!title || !provider || !certificateCode || !issueDateValue || !expiryDateValue) {
    throw validationError("Title, provider, issue date, expiry date, and certificate code are required.");
  }

  const issueDate = new Date(issueDateValue);
  const expiryDate = new Date(expiryDateValue);

  if (Number.isNaN(issueDate.getTime()) || Number.isNaN(expiryDate.getTime())) {
    throw validationError("Issue date and expiry date must be valid dates.");
  }

  if (expiryDate <= issueDate) {
    throw validationError("Expiry date must be later than issue date.");
  }

  const reminderDays = Number(reminderDaysValue);
  if (!Number.isFinite(reminderDays) || reminderDays < 1) {
    throw validationError("Reminder days must be a positive number.");
  }

  return {
    title,
    provider,
    issueDate,
    expiryDate,
    renewalStatus,
    reminderDays,
    certificateCode,
    notes
  };
}

router.get("/export", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const certifications = await Certification.find()
      .populate("user")
      .sort({ expiryDate: 1 });

    const rows = [
      ["userCode", "userName", "userEmail", "title", "provider", "issueDate", "expiryDate", "renewalStatus", "certificateCode", "reminderDays", "notes"],
      ...certifications.map((item) => {
        const card = item.toCard();
        return [
          card.userCode,
          card.userName,
          card.userEmail,
          card.title,
          card.provider,
          card.issueDate,
          card.expiryDate,
          card.renewalStatus,
          card.certificateCode,
          card.reminderDays,
          card.notes
        ];
      })
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="certifications-export.csv"');
    return res.send(toCsv(rows));
  } catch (error) {
    return res.status(500).json({ message: "Failed to export certifications.", details: error.message });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 12));
    const rawCertifications = await Certification.find(buildCertFilters(req))
      .populate("user")
      .sort({ expiryDate: 1 });

    let certifications = rawCertifications.map((item) => item.toCard());
    const status = req.query.status || "All";
    const renewalStatus = req.query.renewalStatus || "All";
    const search = (req.query.search || "").trim().toLowerCase();

    if (status !== "All") {
      certifications = certifications.filter((item) => item.status === status);
    }

    if (renewalStatus !== "All") {
      certifications = certifications.filter((item) => item.renewalStatus === renewalStatus);
    }

    if (search) {
      certifications = certifications.filter((item) => {
        return [
          item.title,
          item.provider,
          item.userName,
          item.userEmail,
          item.userCode,
          item.certificateCode
        ].some((value) => String(value || "").toLowerCase().includes(search));
      });
    }

    return res.json({
      certifications: certifications.slice((page - 1) * pageSize, page * pageSize),
      summary: buildSummary(certifications),
      pagination: {
        page,
        pageSize,
        total: certifications.length,
        totalPages: Math.max(1, Math.ceil(certifications.length / pageSize))
      }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message, details: error.details || error.message });
  }
});

router.post("/", requireAuth, upload.single("certificateFile"), async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Students must submit certification requests for admin approval."
      });
    }

    const targetUserId = req.user.role === "admin" ? req.body.userId : req.user._id.toString();
    if (!targetUserId) {
      throw validationError("Please select a certificate owner before saving.");
    }

    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({ message: "Selected user was not found." });
    }

    const payload = parseCertificationPayload(req);

    const existingCode = await Certification.findOne({ certificateCode: payload.certificateCode });
    if (existingCode) {
      throw validationError("Certificate code already exists. Use a unique certificate code.");
    }

    const certification = await Certification.create({
      user: user._id,
      ...payload,
      certificateFile: req.file ? `/uploads/${path.basename(req.file.path)}` : "",
      notes: payload.notes
    });

    await certification.populate("user");

    return res.status(201).json({
      message: "Certification created successfully.",
      certification: certification.toCard()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to create certification." });
  }
});

router.put("/:id", requireAuth, upload.single("certificateFile"), async (req, res) => {
  try {
    const certification = await Certification.findById(req.params.id).populate("user");
    if (!certification) {
      return res.status(404).json({ message: "Certification not found." });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can edit approved certifications directly."
      });
    }

    const payload = parseCertificationPayload(req, certification);
    const existingCode = await Certification.findOne({
      certificateCode: payload.certificateCode,
      _id: { $ne: certification._id }
    });

    if (existingCode) {
      throw validationError("Certificate code already exists. Use a unique certificate code.");
    }

    certification.title = payload.title;
    certification.provider = payload.provider;
    certification.issueDate = payload.issueDate;
    certification.expiryDate = payload.expiryDate;
    certification.renewalStatus = payload.renewalStatus;
    certification.reminderDays = payload.reminderDays;
    certification.certificateCode = payload.certificateCode;
    certification.notes = payload.notes;

    if (req.file) {
      certification.certificateFile = `/uploads/${path.basename(req.file.path)}`;
    }

    await certification.save();
    await certification.populate("user");

    return res.json({
      message: "Certification updated successfully.",
      certification: certification.toCard()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to update certification." });
  }
});

router.post("/:id/renew", requireAuth, async (req, res) => {
  try {
    const certification = await Certification.findById(req.params.id).populate("user");
    if (!certification) {
      return res.status(404).json({ message: "Certification not found." });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Students must submit renewal requests for admin approval."
      });
    }

    if (!req.body.expiryDate) {
      return res.status(400).json({ message: "New expiry date is required." });
    }

    certification.expiryDate = req.body.expiryDate;
    certification.renewalStatus = req.body.renewalStatus || "Renewed";
    certification.notes = req.body.notes ?? certification.notes;
    certification.lastRenewedAt = new Date();

    await certification.save();
    await certification.populate("user");

    return res.json({
      message: "Certification renewed successfully.",
      certification: certification.toCard()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to renew certification.", details: error.message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const certification = await Certification.findById(req.params.id).populate("user");
    if (!certification) {
      return res.status(404).json({ message: "Certification not found." });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only admins can delete approved certifications."
      });
    }

    await Certification.findByIdAndDelete(req.params.id);

    return res.json({
      message: "Certification deleted successfully."
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete certification.", details: error.message });
  }
});

router.get("/admin/all", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const certifications = await Certification.find().populate("user").sort({ createdAt: -1 });
    return res.json({
      certifications: certifications.map((item) => item.toCard())
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch admin certifications.", details: error.message });
  }
});

module.exports = router;
