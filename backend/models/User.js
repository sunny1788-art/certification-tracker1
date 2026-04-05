const users = [
  {
    id: "admin-1",
    name: "Priya Raman",
    email: "admin@skilltrack.com",
    password: "admin123",
    role: "admin",
    department: "Operations"
  },
  {
    id: "user-1",
    name: "Arjun Patel",
    email: "arjun@skilltrack.com",
    password: "user123",
    role: "user",
    department: "Cloud Engineering"
  },
  {
    id: "user-2",
    name: "Neha Singh",
    email: "neha@skilltrack.com",
    password: "user123",
    role: "user",
    department: "Cybersecurity"
  }
];

function getSafeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department
  };
}

function findUserByEmail(email) {
  return users.find((user) => user.email.toLowerCase() === String(email).toLowerCase());
}

function validateUser(email, password) {
  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    return null;
  }

  return getSafeUser(user);
}

function getUsers() {
  return users.map(getSafeUser);
}

module.exports = {
  getSafeUser,
  validateUser,
  getUsers
};
