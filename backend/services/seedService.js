const User = require("../models/User");
const Course = require("../models/Course");
const Event = require("../models/Event");

async function seedDefaultAdmin() {
  const adminEmail = String(process.env.DEFAULT_ADMIN_EMAIL || "").trim();
  const adminPassword = String(process.env.DEFAULT_ADMIN_PASSWORD || "").trim();

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existingAdmin) {
    return;
  }

  await User.create({
    name: String(process.env.DEFAULT_ADMIN_NAME || "System Admin").trim(),
    email: adminEmail,
    password: adminPassword,
    role: "admin",
    department: "Administration",
    phone: "",
    emailVerified: true,
    phoneVerified: true,
    verificationPending: false
  });

  console.log(`Default admin created: ${adminEmail}`);
}

async function seedLearningCatalog() {
  const admin = await User.findOne({ role: "admin" }).sort({ createdAt: 1 });
  if (!admin) {
    return;
  }

  if ((await Course.countDocuments()) === 0) {
    await Course.insertMany([
      {
        title: "Cloud Foundations Bootcamp",
        description: "Admin-posted course for cloud essentials, certification prep, quizzes, and assignment review.",
        skillCategory: "Cloud",
        level: "Beginner",
        durationHours: 14,
        certificationTitle: "Cloud Foundations Completion Certificate",
        issuer: "Skill Certification Tracking Portal",
        passingScore: 70,
        expiryMonths: 24,
        modules: ["Cloud basics", "AWS essentials", "Azure fundamentals", "Deployment practice"],
        assignments: ["Create a cloud migration checklist", "Submit a deployment reflection"],
        quizQuestions: [
          { question: "What does IaaS stand for?", options: ["Infrastructure as a Service", "Internet as a Service", "Integration as a Service"], answerIndex: 0 },
          { question: "Which model offers managed applications?", options: ["PaaS", "On-premise only", "Hardware only"], answerIndex: 0 }
        ],
        createdBy: admin._id
      },
      {
        title: "Secure Web Engineering Lab",
        description: "Focus on web security, secure coding, assignments, and admin-reviewed completion.",
        skillCategory: "Security",
        level: "Intermediate",
        durationHours: 18,
        certificationTitle: "Secure Web Engineering Certificate",
        issuer: "Skill Certification Tracking Portal",
        passingScore: 75,
        expiryMonths: 18,
        modules: ["OWASP basics", "Authentication hardening", "Threat modeling", "API security"],
        assignments: ["Audit a login flow", "Prepare a threat model document"],
        quizQuestions: [
          { question: "Which is an OWASP risk?", options: ["Broken access control", "Extra RAM", "High bandwidth"], answerIndex: 0 },
          { question: "Which token mechanism is commonly used?", options: ["JWT", "TXT", "CSV"], answerIndex: 0 }
        ],
        createdBy: admin._id
      },
      {
        title: "Data Analytics Accelerator",
        description: "Analytics roadmap with dashboards, SQL practice, and a scored assignment submission.",
        skillCategory: "Data",
        level: "Beginner",
        durationHours: 12,
        certificationTitle: "Data Analytics Accelerator Certificate",
        issuer: "Skill Certification Tracking Portal",
        passingScore: 72,
        expiryMonths: 24,
        modules: ["SQL basics", "Dashboards", "KPIs", "Data storytelling"],
        assignments: ["Build a KPI summary", "Explain a dashboard insight deck"],
        quizQuestions: [
          { question: "Which statement retrieves records?", options: ["SELECT", "DELETE", "DROP"], answerIndex: 0 }
        ],
        createdBy: admin._id
      }
    ]);
  }

  if ((await Event.countDocuments()) === 0) {
    await Event.insertMany([
      {
        title: "Cyber Awareness Skill Event",
        description: "Registration-based live event with demonstrations, speaker session, and participation tracking.",
        category: "Security Event",
        mode: "hybrid",
        location: "Main Seminar Hall / Online Meet",
        startDate: new Date("2026-05-15"),
        endDate: new Date("2026-05-15"),
        registrationDeadline: new Date("2026-05-12"),
        capacity: 250,
        status: "open",
        createdBy: admin._id
      },
      {
        title: "Cloud Career Roadmap Webinar",
        description: "Admin-posted webinar for students to register and learn certification pathways.",
        category: "Career Event",
        mode: "online",
        location: "Zoom",
        startDate: new Date("2026-05-22"),
        endDate: new Date("2026-05-22"),
        registrationDeadline: new Date("2026-05-20"),
        capacity: 500,
        status: "open",
        createdBy: admin._id
      }
    ]);
  }
}

module.exports = {
  seedDefaultAdmin,
  seedLearningCatalog
};
