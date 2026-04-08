const User = require("../models/User");

async function seedDefaultAdmin() {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existingAdmin) {
    return;
  }

  await User.create({
    name: process.env.DEFAULT_ADMIN_NAME || "System Admin",
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
