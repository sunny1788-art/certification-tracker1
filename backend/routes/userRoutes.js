const express = require("express");
const path = require("path");
const User = require("../models/User");
const Certification = require("../models/Certification");
const CourseEnrollment = require("../models/CourseEnrollment");
const { requireAuth, requireRole } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

function toCsv(rows) {
  const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(escapeCell).join(",")).join("\n");
}

router.get("/export", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const rows = [
      ["userId", "name", "email", "role", "department", "phone", "isActive", "createdAt"],
      ...users.map((user) => [
        user.userId || "",
        user.name,
        user.email,
        user.role,
        user.department,
        user.phone,
        user.isActive,
        user.createdAt.toISOString()
      ])
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="users-export.csv"');
    return res.send(toCsv(rows));
  } catch (error) {
    return res.status(500).json({ message: "Failed to export users.", details: error.message });
  }
});

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 12));
    const search = (req.query.search || "").trim();
    const filters = search
      ? {
          $or: [
            { userId: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { department: { $regex: search, $options: "i" } },
            { role: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filters)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      User.countDocuments(filters)
    ]);

    const userIds = users.map((user) => user._id);
    const [certCounts, enrollmentStats] = await Promise.all([
      Certification.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: "$user", certifications: { $sum: 1 } } }
      ]),
      CourseEnrollment.aggregate([
        { $match: { user: { $in: userIds } } },
        {
          $group: {
            _id: "$user",
            totalCourses: { $sum: 1 },
            coursesCompleted: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
            pendingCourses: { $sum: { $cond: [{ $eq: ["$status", "pending_approval"] }, 1, 0] } },
            averageScore: { $avg: "$averageScore" },
            progressPercent: { $avg: "$progressPercent" }
          }
        }
      ])
    ]);

    const certMap = certCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.certifications;
      return acc;
    }, {});
    const courseMap = enrollmentStats.reduce((acc, item) => {
      acc[item._id.toString()] = item;
      return acc;
    }, {});

    return res.json({
      users: users.map((user) => {
        const safeUser = user.toSafeObject();
        const courseStats = courseMap[user._id.toString()] || {};
        return {
          ...safeUser,
          stats: {
            certifications: certMap[user._id.toString()] || 0,
            totalCourses: courseStats.totalCourses || 0,
            coursesCompleted: courseStats.coursesCompleted || 0,
            pendingCourses: courseStats.pendingCourses || 0,
            averageScore: Math.round(courseStats.averageScore || 0),
            progressPercent: Math.round(courseStats.progressPercent || 0)
          }
        };
      }),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users.", details: error.message });
  }
});

router.post("/", requireAuth, requireRole("admin"), upload.single("profilePhoto"), async (req, res) => {
  try {
    const { name, email, password, role, department, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: "Email already exists." });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role === "admin" ? "admin" : "student",
      department: department || "General",
      phone: phone || "",
      profilePhoto: req.file ? `/uploads/${path.basename(req.file.path)}` : "",
      emailVerified: true,
      phoneVerified: true,
      verificationPending: false
    });

    return res.status(201).json({
      message: "User created successfully.",
      user: user.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create user.", details: error.message });
  }
});

router.put("/:id", requireAuth, upload.single("profilePhoto"), async (req, res) => {
  try {
    const { id } = req.params;
    const isOwnProfile = req.user._id.toString() === id;
    const isAdmin = req.user.role === "admin";

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to update this user." });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    targetUser.name = req.body.name ?? targetUser.name;
    targetUser.department = req.body.department ?? targetUser.department;
    targetUser.phone = req.body.phone ?? targetUser.phone;
    if (req.file) {
      targetUser.profilePhoto = `/uploads/${path.basename(req.file.path)}`;
    }

    if (isAdmin) {
      if (req.body.role === "admin" || req.body.role === "student") {
        targetUser.role = req.body.role;
      }
      if (typeof req.body.isActive !== "undefined") {
        targetUser.isActive = req.body.isActive === true || req.body.isActive === "true";
      }
      if (typeof req.body.blockedReason !== "undefined") {
        targetUser.blockedReason = String(req.body.blockedReason || "").trim();
      }
      if (typeof req.body.suspiciousReason !== "undefined") {
        targetUser.suspiciousReason = String(req.body.suspiciousReason || "").trim();
      }
    }

    if (req.body.password) {
      targetUser.password = req.body.password;
    }

    await targetUser.save();

    return res.json({
      message: "User updated successfully.",
      user: targetUser.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update user.", details: error.message });
  }
});

router.get("/:id/insights", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const [certifications, enrollments] = await Promise.all([
      Certification.find({ user: user._id }).sort({ createdAt: -1 }),
      CourseEnrollment.find({ user: user._id }).populate("course").populate("certification").sort({ createdAt: -1 })
    ]);

    return res.json({
      user: user.toSafeObject(),
      insights: {
        certifications: certifications.length,
        coursesCompleted: enrollments.filter((item) => item.status === "approved").length,
        pendingCourses: enrollments.filter((item) => item.status === "pending_approval").length,
        progressPercent: enrollments.length ? Math.round(enrollments.reduce((sum, item) => sum + (item.progressPercent || 0), 0) / enrollments.length) : 0,
        averageScore: enrollments.length ? Math.round(enrollments.reduce((sum, item) => sum + (item.averageScore || 0), 0) / enrollments.length) : 0,
        recentEnrollments: enrollments.slice(0, 6).map((item) => item.toClient())
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load user insights.", details: error.message });
  }
});

router.post("/:id/block", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ message: "You cannot block your own admin account." });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.isActive = false;
    user.blockedReason = String(req.body.reason || "Blocked by admin due to suspicious activity.").trim();
    await user.save();

    return res.json({
      message: "User blocked successfully.",
      user: user.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to block user.", details: error.message });
  }
});

router.post("/:id/unblock", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.isActive = true;
    user.blockedReason = "";
    await user.save();

    return res.json({
      message: "User unblocked successfully.",
      user: user.toSafeObject()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to unblock user.", details: error.message });
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user._id.toString() === id) {
      return res.status(400).json({ message: "You cannot delete your own admin account." });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    await Certification.deleteMany({ user: id });

    return res.json({ message: "User and related certifications deleted successfully." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete user.", details: error.message });
  }
});

module.exports = router;
