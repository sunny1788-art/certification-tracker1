const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const connectDatabase = require("./config/db");
const User = require("./models/User");
const Certification = require("./models/Certification");
const { requireAuth, requireRole } = require("./middleware/auth");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const certificationRoutes = require("./routes/certRoutes");
const alertRoutes = require("./routes/alertRoutes");
const requestRoutes = require("./routes/requestRoutes");
const learningRoutes = require("./routes/learningRoutes");
const eventRoutes = require("./routes/eventRoutes");
const { seedDefaultAdmin, seedLearningCatalog } = require("./services/seedService");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDir = path.join(__dirname, "..", "frontend");
const uploadsDir = path.join(__dirname, "..", "uploads");
const runtimeUploadsDir = process.env.VERCEL ? path.join(require("os").tmpdir(), "skillcert-uploads") : uploadsDir;

function toCsv(rows) {
  const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(escapeCell).join(",")).join("\n");
}

if (!fs.existsSync(runtimeUploadsDir)) {
  fs.mkdirSync(runtimeUploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(runtimeUploadsDir));

let bootstrapPromise = null;

function bootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = connectDatabase().then(async () => {
      await seedDefaultAdmin();
      await seedLearningCatalog();
    });
  }
  return bootstrapPromise;
}

app.use(async (req, res, next) => {
  try {
    await bootstrap();
    return next();
  } catch (error) {
    return next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/certifications", certificationRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/events", eventRoutes);

app.get("/api/exports/users", requireAuth, requireRole("admin"), async (req, res) => {
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
});

app.get("/api/exports/certifications", requireAuth, requireRole("admin"), async (req, res) => {
  const certifications = await Certification.find().populate("user").sort({ expiryDate: 1 });
  const rows = [
    ["userCode", "userName", "userEmail", "title", "provider", "issueDate", "expiryDate", "renewalStatus", "certificateCode", "reminderDays", "notes"],
    ...certifications.map((item) => [
      item.user?.userId || "",
      item.user?.name || "",
      item.user?.email || "",
      item.title,
      item.provider,
      item.issueDate.toISOString().slice(0, 10),
      item.expiryDate.toISOString().slice(0, 10),
      item.renewalStatus,
      item.certificateCode,
      item.reminderDays,
      item.notes
    ])
  ];

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="certifications-export.csv"');
  return res.send(toCsv(rows));
});

app.use(express.static(frontendDir));

app.get("/api/health", (req, res) => {
  res.json({
    message: "Backend is running.",
    database: "MongoDB",
    timestamp: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(frontendDir, "login.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(frontendDir, "dashboard.html"));
});

app.get("/admin/overview", (req, res) => {
  res.sendFile(path.join(frontendDir, "admin-overview.html"));
});

app.get("/admin/users", (req, res) => {
  res.sendFile(path.join(frontendDir, "admin-users.html"));
});

app.get("/admin/certifications", (req, res) => {
  res.sendFile(path.join(frontendDir, "admin-certifications.html"));
});

app.get("/admin/requests", (req, res) => {
  res.sendFile(path.join(frontendDir, "admin-requests.html"));
});

app.get("/admin/profile", (req, res) => {
  res.sendFile(path.join(frontendDir, "admin-profile.html"));
});

app.get("/admin/learning", (req, res) => {
  res.sendFile(path.join(frontendDir, "admin-learning.html"));
});

app.get("/student/overview", (req, res) => {
  res.sendFile(path.join(frontendDir, "student-overview.html"));
});

app.get("/student/certifications", (req, res) => {
  res.sendFile(path.join(frontendDir, "student-certifications.html"));
});

app.get("/student/requests", (req, res) => {
  res.sendFile(path.join(frontendDir, "student-requests.html"));
});

app.get("/student/profile", (req, res) => {
  res.sendFile(path.join(frontendDir, "student-profile.html"));
});

app.get("/student/learning", (req, res) => {
  res.sendFile(path.join(frontendDir, "student-learning.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.use((error, req, res, next) => {
  if (error) {
    return res.status(400).json({
      message: error.message || "Request failed."
    });
  }

  return next();
});

async function startServer() {
  try {
    await bootstrap();

    app.listen(PORT, () => {
      console.log(`Certification tracker running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
