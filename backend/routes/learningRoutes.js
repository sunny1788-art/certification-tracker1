const express = require("express");
const Course = require("../models/Course");
const CourseEnrollment = require("../models/CourseEnrollment");
const Certification = require("../models/Certification");
const CertificationRequest = require("../models/CertificationRequest");
const Event = require("../models/Event");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseList(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseQuizQuestions(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        question: String(item.question || "").trim(),
        options: Array.isArray(item.options) ? item.options.map((option) => String(option || "").trim()).filter(Boolean) : [],
        answerIndex: Number(item.answerIndex) || 0
      }))
      .filter((item) => item.question);
  } catch (error) {
    return [];
  }
}

function parseCoursePayload(req, existing = null) {
  const source = req.body || {};
  const title = String(source.title ?? existing?.title ?? "").trim();
  const certificationTitle = String(source.certificationTitle ?? existing?.certificationTitle ?? title).trim();

  if (!title) {
    throw validationError("Course title is required.");
  }

  return {
    title,
    description: String(source.description ?? existing?.description ?? "").trim(),
    skillCategory: String(source.skillCategory ?? existing?.skillCategory ?? "General").trim() || "General",
    level: String(source.level ?? existing?.level ?? "Beginner").trim() || "Beginner",
    durationHours: Number(source.durationHours ?? existing?.durationHours ?? 6) || 6,
    certificationTitle,
    issuer: String(source.issuer ?? existing?.issuer ?? "Skill Certification Tracking Portal").trim() || "Skill Certification Tracking Portal",
    passingScore: Number(source.passingScore ?? existing?.passingScore ?? 70) || 70,
    expiryMonths: Number(source.expiryMonths ?? existing?.expiryMonths ?? 24) || 24,
    status: ["active", "draft", "archived"].includes(String(source.status ?? existing?.status ?? "active")) ? String(source.status ?? existing?.status ?? "active") : "active",
    modules: parseList(source.modules ?? existing?.modules?.join("\n") ?? ""),
    assignments: parseList(source.assignments ?? existing?.assignments?.join("\n") ?? ""),
    quizQuestions: parseQuizQuestions(source.quizQuestions ?? existing?.quizQuestions ?? [])
  };
}

function buildGeneratedCode(user, course, enrollment) {
  const userCode = user.userId || user._id.toString().slice(-6).toUpperCase();
  const courseCode = course._id.toString().slice(-6).toUpperCase();
  const enrollmentCode = enrollment._id.toString().slice(-4).toUpperCase();
  return `${userCode}-CRS-${courseCode}-${enrollmentCode}`;
}

router.get("/summary", requireAuth, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const [totalUsers, blockedUsers, suspiciousUsers, totalCourses, totalEnrollments, pendingApprovals, totalEvents, totalRegistrations] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: false }),
        User.countDocuments({ suspiciousScore: { $gt: 0 } }),
        Course.countDocuments(),
        CourseEnrollment.countDocuments(),
        CourseEnrollment.countDocuments({ status: "pending_approval" }),
        Event.countDocuments(),
        Event.aggregate([{ $project: { count: { $size: "$registrations" } } }, { $group: { _id: null, total: { $sum: "$count" } } }])
      ]);

      return res.json({
        summary: {
          totalUsers,
          blockedUsers,
          suspiciousUsers,
          totalCourses,
          totalEnrollments,
          pendingApprovals,
          totalEvents,
          totalRegistrations: totalRegistrations[0]?.total || 0
        }
      });
    }

    const [enrollments, certifications, requests, events] = await Promise.all([
      CourseEnrollment.find({ user: req.user._id }).populate("course").populate("certification"),
      Certification.countDocuments({ user: req.user._id }),
      CertificationRequest.countDocuments({ student: req.user._id, status: "pending" }),
      Event.find({ "registrations.user": req.user._id })
    ]);

    const completedCourses = enrollments.filter((item) => item.status === "approved").length;
    const pendingCourses = enrollments.filter((item) => item.status === "pending_approval").length;
    const courseProgressPercent = enrollments.length
      ? Math.round(enrollments.reduce((sum, item) => sum + (item.progressPercent || 0), 0) / enrollments.length)
      : 0;
    const averageScore = enrollments.length
      ? Math.round(enrollments.reduce((sum, item) => sum + (item.averageScore || 0), 0) / enrollments.length)
      : 0;

    return res.json({
      summary: {
        completedCourses,
        pendingCourses,
        certifications,
        pendingRequests: requests,
        registeredEvents: events.length,
        courseProgressPercent,
        averageScore
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to build learning summary.", details: error.message });
  }
});

router.get("/courses", requireAuth, async (req, res) => {
  try {
    const search = String(req.query.search || "").trim().toLowerCase();
    const filters = req.user.role === "admin" ? {} : { status: "active" };
    const courses = await Course.find(filters).sort({ createdAt: -1 });
    let filtered = courses;

    if (search) {
      filtered = filtered.filter((course) =>
        [course.title, course.description, course.skillCategory, course.level, course.certificationTitle].some((value) =>
          String(value || "").toLowerCase().includes(search)
        )
      );
    }

    const courseIds = filtered.map((course) => course._id);
    const enrollments = await CourseEnrollment.find(
      req.user.role === "admin"
        ? { course: { $in: courseIds } }
        : { course: { $in: courseIds }, user: req.user._id }
    )
      .populate("user")
      .populate("course")
      .populate("certification");

    const byCourse = enrollments.reduce((acc, enrollment) => {
      const key = enrollment.course?._id?.toString() || enrollment.course.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(enrollment);
      return acc;
    }, {});

    return res.json({
      courses: filtered.map((course) => {
        const list = byCourse[course._id.toString()] || [];
        if (req.user.role === "admin") {
          const approvedCount = list.filter((item) => item.status === "approved").length;
          const pendingCount = list.filter((item) => item.status === "pending_approval").length;
          return course.toCard({
            totalEnrollments: list.length,
            approvedCount,
            pendingCount,
            averageLearnerScore: list.length ? Math.round(list.reduce((sum, item) => sum + (item.averageScore || 0), 0) / list.length) : 0
          });
        }

        return course.toCard({
          enrollment: list[0] ? list[0].toClient() : null
        });
      })
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch courses.", details: error.message });
  }
});

router.post("/courses", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const payload = parseCoursePayload(req);
    const course = await Course.create({
      ...payload,
      createdBy: req.user._id
    });

    return res.status(201).json({
      message: "Course created successfully.",
      course: course.toCard()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to create course." });
  }
});

router.put("/courses/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    Object.assign(course, parseCoursePayload(req, course));
    await course.save();

    return res.json({
      message: "Course updated successfully.",
      course: course.toCard()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to update course." });
  }
});

router.post("/courses/:id/register", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course || course.status !== "active") {
      return res.status(404).json({ message: "Course is not available for registration." });
    }

    const [enrollment] = await Promise.all([
      CourseEnrollment.findOneAndUpdate(
        { user: req.user._id, course: course._id },
        { $setOnInsert: { user: req.user._id, course: course._id } },
        { new: true, upsert: true }
      ).populate("course").populate("user").populate("certification")
    ]);

    return res.status(201).json({
      message: "Course registration completed.",
      enrollment: enrollment.toClient()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to register for course.", details: error.message });
  }
});

router.get("/enrollments", requireAuth, async (req, res) => {
  try {
    const filters = req.user.role === "admin" ? {} : { user: req.user._id };
    if (req.query.status) {
      filters.status = req.query.status;
    }

    const enrollments = await CourseEnrollment.find(filters)
      .populate("user")
      .populate("course")
      .populate("certification")
      .sort({ createdAt: -1 });

    return res.json({
      enrollments: enrollments.map((item) => item.toClient())
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch enrollments.", details: error.message });
  }
});

router.post("/enrollments/:id/submit", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const enrollment = await CourseEnrollment.findById(req.params.id).populate("course").populate("user");
    if (!enrollment || enrollment.user._id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    const quizScore = Math.max(0, Math.min(100, Number(req.body.quizScore) || 0));
    const assignmentScore = Math.max(0, Math.min(100, Number(req.body.assignmentScore) || 0));
    const progressPercent = Math.max(0, Math.min(100, Number(req.body.progressPercent) || 0));
    enrollment.quizScore = quizScore;
    enrollment.assignmentScore = assignmentScore;
    enrollment.progressPercent = progressPercent;
    enrollment.averageScore = Math.round((quizScore + assignmentScore) / 2);
    enrollment.assignmentLink = String(req.body.assignmentLink || "").trim();
    enrollment.assignmentNotes = String(req.body.assignmentNotes || "").trim();
    enrollment.submittedAt = new Date();
    enrollment.status = "pending_approval";
    await enrollment.save();

    return res.json({
      message: "Course completion submitted for admin approval.",
      enrollment: enrollment.toClient()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit course progress.", details: error.message });
  }
});

router.post("/enrollments/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const enrollment = await CourseEnrollment.findById(req.params.id).populate("course").populate("user").populate("certification");
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    if (enrollment.averageScore < (enrollment.course?.passingScore || 70)) {
      throw validationError("Learner score is below the passing score. Approve only after updating the submission.");
    }

    enrollment.status = "approved";
    enrollment.progressPercent = 100;
    enrollment.approvedAt = new Date();
    enrollment.approvedBy = req.user._id;
    enrollment.adminNote = String(req.body.adminNote || "").trim();

    if (!enrollment.certification) {
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + (enrollment.course?.expiryMonths || 24));

      const certification = await Certification.create({
        user: enrollment.user._id,
        title: enrollment.course?.certificationTitle || enrollment.course?.title || "Course Completion Certificate",
        provider: enrollment.course?.issuer || "Skill Certification Tracking Portal",
        issueDate: now,
        expiryDate,
        renewalStatus: "Not Started",
        reminderDays: 30,
        certificateCode: buildGeneratedCode(enrollment.user, enrollment.course, enrollment),
        notes: `Generated automatically after admin approval for course: ${enrollment.course?.title || ""}`
      });

      enrollment.certification = certification._id;
    }

    await enrollment.save();
    await enrollment.populate("certification");

    return res.json({
      message: "Course approved and certificate generated.",
      enrollment: enrollment.toClient()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to approve course." });
  }
});

router.post("/enrollments/:id/reject", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const enrollment = await CourseEnrollment.findById(req.params.id).populate("course").populate("user");
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    enrollment.status = "rejected";
    enrollment.adminNote = String(req.body.adminNote || "Please improve the quiz or assignment submission.").trim();
    await enrollment.save();

    return res.json({
      message: "Course submission rejected.",
      enrollment: enrollment.toClient()
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reject course submission.", details: error.message });
  }
});

router.post("/enrollments/:id/rate", requireAuth, requireRole("student"), async (req, res) => {
  try {
    const enrollment = await CourseEnrollment.findById(req.params.id).populate("course").populate("user");
    if (!enrollment || enrollment.user._id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    if (enrollment.status !== "approved") {
      throw validationError("You can rate a course only after approval.");
    }

    const stars = Math.max(1, Math.min(5, Number(req.body.stars) || 0));
    if (!stars) {
      throw validationError("A rating between 1 and 5 is required.");
    }

    const previousStars = enrollment.stars || 0;
    enrollment.stars = stars;
    await enrollment.save();

    const course = enrollment.course;
    const totalRating = Number(course.ratingAverage || 0) * Number(course.ratingCount || 0) - previousStars + stars;
    course.ratingCount = previousStars ? course.ratingCount : course.ratingCount + 1;
    course.ratingAverage = course.ratingCount ? totalRating / course.ratingCount : stars;
    await course.save();

    return res.json({
      message: "Rating saved successfully.",
      enrollment: enrollment.toClient(),
      course: course.toCard()
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "Failed to save rating." });
  }
});

module.exports = router;
