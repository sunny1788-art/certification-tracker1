const express = require("express");
const path = require("path");
const Certification = require("../models/Certification");
const CertificationRequest = require("../models/CertificationRequest");
const { requireAuth, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseDate(value, fieldName) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError(`${fieldName} must be a valid date.`);
  }
  return parsed;
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const filters = req.user.role === "admin" ? {} : { student: req.user._id };
    const requests = await CertificationRequest.find(filters)
      .populate("student")
      .populate("certification")
      .sort({ createdAt: -1 });

    return res.json({
      requests: requests.map((request) => request.toClient())
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch requests.", details: error.message });
  }
});

router.post("/add", requireAuth, upload.single("proofFile"), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can create certification requests." });
    }

    const title = String(req.body.title || "").trim();
    const provider = String(req.body.provider || "").trim();
    const certificateCode = String(req.body.certificateCode || "").trim();
    const issueDate = parseDate(req.body.issueDate, "Issue date");
    const expiryDate = parseDate(req.body.expiryDate, "Expiry date");

    if (!title || !provider || !certificateCode) {
      throw validationError("Title, provider, and certificate code are required.");
    }

    if (expiryDate <= issueDate) {
      throw validationError("Expiry date must be later than issue date.");
    }

    const request = await CertificationRequest.create({
      requestType: "add",
      student: req.user._id,
      title,
      provider,
      issueDate,
      expiryDate,
      renewalStatus: req.body.renewalStatus || "Not Started",
      reminderDays: Number(req.body.reminderDays) || 30,
      certificateCode,
      notes: req.body.notes || "",
      proofLink: req.body.proofLink || "",
      proofFile: req.file ? `/uploads/${path.basename(req.file.path)}` : ""
    });

    await request.populate("student");

    return res.status(201).json({
      message: "Certification request submitted for admin approval.",
      request: request.toClient()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to submit request." });
  }
});

router.post("/renew/:certificationId", requireAuth, upload.single("proofFile"), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students can create renewal requests." });
    }

    const certification = await Certification.findById(req.params.certificationId).populate("user");
    if (!certification) {
      return res.status(404).json({ message: "Certification not found." });
    }

    if (certification.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only renew your own certification." });
    }

    const expiryDate = parseDate(req.body.expiryDate, "Expiry date");
    if (expiryDate <= certification.issueDate) {
      throw validationError("New expiry date must be later than the issue date.");
    }

    const request = await CertificationRequest.create({
      requestType: "renew",
      student: req.user._id,
      certification: certification._id,
      title: certification.title,
      provider: certification.provider,
      issueDate: certification.issueDate,
      expiryDate,
      renewalStatus: "Pending Submission",
      reminderDays: certification.reminderDays,
      certificateCode: certification.certificateCode,
      notes: req.body.notes || "",
      proofLink: req.body.proofLink || "",
      proofFile: req.file ? `/uploads/${path.basename(req.file.path)}` : ""
    });

    await request.populate("student");
    await request.populate("certification");

    return res.status(201).json({
      message: "Renewal request submitted for admin approval.",
      request: request.toClient()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to submit renewal request." });
  }
});

router.post("/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const request = await CertificationRequest.findById(req.params.id)
      .populate("student")
      .populate("certification");

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be approved." });
    }

    if (request.requestType === "add") {
      const existingCode = await Certification.findOne({ certificateCode: request.certificateCode });
      if (existingCode) {
        throw validationError("Certificate code already exists. Reject or modify this request.");
      }

      await Certification.create({
        user: request.student._id,
        title: request.title,
        provider: request.provider,
        issueDate: request.issueDate,
        expiryDate: request.expiryDate,
        renewalStatus: request.renewalStatus || "Not Started",
        reminderDays: request.reminderDays,
        certificateCode: request.certificateCode,
        certificateFile: request.proofFile || "",
        notes: request.notes
      });
    }

    if (request.requestType === "renew") {
      if (!request.certification) {
        return res.status(400).json({ message: "Linked certification no longer exists." });
      }

      request.certification.expiryDate = request.expiryDate;
      request.certification.renewalStatus = "Renewed";
      request.certification.notes = request.notes || request.certification.notes;
      request.certification.lastRenewedAt = new Date();
      if (request.proofFile) {
        request.certification.certificateFile = request.proofFile;
      }
      await request.certification.save();
    }

    request.status = "approved";
    request.adminNote = req.body.adminNote || "";
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    return res.json({
      message: "Request approved successfully.",
      request: request.toClient()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to approve request." });
  }
});

router.post("/:id/reject", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const request = await CertificationRequest.findById(req.params.id)
      .populate("student")
      .populate("certification");

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be rejected." });
    }

    request.status = "rejected";
    request.adminNote = req.body.adminNote || "Rejected by admin.";
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    return res.json({
      message: "Request rejected.",
      request: request.toClient()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reject request.", details: error.message });
  }
});

module.exports = router;
