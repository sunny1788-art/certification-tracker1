const { validateUser, getUsers } = require("../models/User");

function handleAuth(req, res, body, sendJson) {
  if (req.method === "POST" && req.url === "/api/login") {
    const user = validateUser(body.email, body.password);

    if (!user) {
      sendJson(res, 401, { message: "Invalid email or password." });
      return true;
    }

    sendJson(res, 200, {
      message: "Login successful.",
      user,
      availableUsers: getUsers().filter((entry) => entry.role === "user")
    });
    return true;
  }

  if (req.method === "GET" && req.url === "/api/users") {
    sendJson(res, 200, {
      users: getUsers()
    });
    return true;
  }

  return false;
}

module.exports = {
  handleAuth
};
