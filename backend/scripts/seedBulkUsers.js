const dotenv = require("dotenv");
const mongoose = require("mongoose");
const connectDatabase = require("../config/db");
const User = require("../models/User");
const Certification = require("../models/Certification");

dotenv.config();

const DEPARTMENT_CERTIFICATIONS = {
  "Cloud Engineering": [
    ["AWS Cloud Practitioner", "Amazon Web Services"],
    ["Microsoft Azure Fundamentals", "Microsoft"],
    ["Google Cloud Digital Leader", "Google Cloud"],
    ["Red Hat System Administration", "Red Hat"],
    ["Oracle Cloud Infrastructure Foundations", "Oracle"]
  ],
  Cybersecurity: [
    ["CompTIA Security+", "CompTIA"],
    ["Certified Ethical Hacker", "EC-Council"],
    ["Cisco CyberOps Associate", "Cisco"],
    ["ISO 27001 Foundation", "PECB"],
    ["Fortinet NSE 1", "Fortinet"]
  ],
  Networking: [
    ["Cisco CCNA", "Cisco"],
    ["Juniper JNCIA-Junos", "Juniper"],
    ["CompTIA Network+", "CompTIA"],
    ["Aruba Mobility Associate", "Aruba"],
    ["Palo Alto Network Security Fundamentals", "Palo Alto"]
  ],
  "Software Engineering": [
    ["Oracle Java Foundations", "Oracle"],
    ["Microsoft Power Platform Fundamentals", "Microsoft"],
    ["Certified ScrumMaster", "Scrum Alliance"],
    ["GitHub Foundations", "GitHub"],
    ["Red Hat OpenShift Foundations", "Red Hat"]
  ],
  "Data Analytics": [
    ["Microsoft Power BI Data Analyst", "Microsoft"],
    ["Google Data Analytics", "Google"],
    ["Tableau Desktop Specialist", "Tableau"],
    ["AWS Data Analytics Essentials", "Amazon Web Services"],
    ["Oracle Database Foundations", "Oracle"]
  ],
  "IT Service Management": [
    ["ITIL Foundation", "Axelos"],
    ["ServiceNow System Administrator", "ServiceNow"],
    ["Microsoft 365 Fundamentals", "Microsoft"],
    ["Salesforce Administrator", "Salesforce"],
    ["Scrum Fundamentals", "Scrum Study"]
  ]
};

const RENEWAL_STATUSES = [
  "Not Started",
  "Scheduled",
  "Pending Submission",
  "Action Required",
  "Renewed"
];

function buildUsers() {
  const departments = [
    "Cloud Engineering",
    "Cybersecurity",
    "Networking",
    "Software Engineering",
    "Data Analytics",
    "IT Service Management"
  ];

  const users = [
    {
      userId: "2400031410",
      name: "POTHINENI SAI SASANK",
      email: "psaisasank1788@gmail.com",
      password: "Sasank@1788",
      phone: "8074863261",
      role: "student",
      department: "Software Engineering"
    }
  ];

  for (let index = 2; index <= 100; index += 1) {
    users.push({
      userId: `U${String(1000 + index)}`,
      name: `User ${index}`,
      email: `user${index}@gmail.com`,
      password: "User@123",
      phone: `9000000${String(index).padStart(3, "0")}`,
      role: "student",
      department: departments[(index - 2) % departments.length]
    });
  }

  return users;
}

function getDates(index, certIndex) {
  const issueYear = 2023 + ((index + certIndex) % 3);
  const issueMonth = ((index + certIndex) % 12) + 1;
  const issueDay = ((index * 2 + certIndex) % 24) + 1;
  const expiryYear = issueYear + 2 + (certIndex % 2);
  const expiryMonth = ((issueMonth + certIndex + 2) % 12) + 1;
  const expiryDay = Math.min(issueDay + 2, 28);

  return {
    issueDate: new Date(Date.UTC(issueYear, issueMonth - 1, issueDay)),
    expiryDate: new Date(Date.UTC(expiryYear, expiryMonth - 1, expiryDay))
  };
}

function buildCertificationsForUser(user, index) {
  const count = 5 + (index % 6);
  const pool = DEPARTMENT_CERTIFICATIONS[user.department] || DEPARTMENT_CERTIFICATIONS["Software Engineering"];
  const certifications = [];

  for (let certIndex = 0; certIndex < count; certIndex += 1) {
    const [title, provider] = pool[(index + certIndex) % pool.length];
    const { issueDate, expiryDate } = getDates(index, certIndex);
    const renewalStatus = RENEWAL_STATUSES[(index + certIndex) % RENEWAL_STATUSES.length];

    certifications.push({
      user: user._id,
      title,
      provider,
      issueDate,
      expiryDate,
      renewalStatus,
      reminderDays: 30 + ((index + certIndex) % 31),
      certificateCode: `${user.userId}-CERT-${String(certIndex + 1).padStart(2, "0")}`,
      notes: `Auto-generated sample certification ${certIndex + 1} for ${user.name}.`,
      certificateFile: ""
    });
  }

  return certifications;
}

async function upsertUsers(users) {
  const results = [];

  for (const userData of users) {
    let user = await User.findOne({
      $or: [{ email: userData.email.toLowerCase() }, { userId: userData.userId }]
    });

    if (!user) {
      user = new User({
        userId: userData.userId,
        name: userData.name,
        email: userData.email.toLowerCase(),
        password: userData.password,
        phone: userData.phone,
        role: userData.role,
        department: userData.department,
        isActive: true
      });
      await user.save();
    } else {
      user.userId = userData.userId;
      user.name = userData.name;
      user.email = userData.email.toLowerCase();
      user.phone = userData.phone;
      user.department = userData.department;
      user.role = "student";
      user.isActive = true;
      await user.save();
    }

    results.push(user);
  }

  return results;
}

async function seedCertifications(users) {
  let createdCount = 0;

  await Certification.deleteMany({
    user: { $in: users.map((user) => user._id) },
    certificateCode: { $regex: /-CERT-/ }
  });

  for (let index = 0; index < users.length; index += 1) {
    const user = users[index];
    const certifications = buildCertificationsForUser(user, index + 1);

    for (const certificationData of certifications) {
      const exists = await Certification.findOne({ certificateCode: certificationData.certificateCode });
      if (exists) {
        continue;
      }

      await Certification.create(certificationData);
      createdCount += 1;
    }
  }

  return createdCount;
}

async function run() {
  try {
    await connectDatabase();
    const userSeedData = buildUsers();
    const users = await upsertUsers(userSeedData);
    const createdCertifications = await seedCertifications(users);

    console.log(`Users available: ${users.length}`);
    console.log(`New certifications created: ${createdCertifications}`);
    console.log("Bulk seed completed successfully.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Bulk seed failed:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

run();
