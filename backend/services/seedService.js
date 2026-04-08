const User = require("../models/User");

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
    phone: ""
  });

  console.log(`Default admin created: ${adminEmail}`);
}

module.exports = {
  seedDefaultAdmin
};
