const dotenv = require("dotenv");
const connectDatabase = require("../config/db");
const { seedDefaultAdmin } = require("../services/seedService");

dotenv.config();

async function run() {
  try {
    await connectDatabase();
    await seedDefaultAdmin();
    console.log("Admin seed completed.");
    process.exit(0);
  } catch (error) {
    console.error("Admin seed failed:", error.message);
    process.exit(1);
  }
}

run();
