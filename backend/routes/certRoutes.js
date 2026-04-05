const {
  getCertifications,
  getCertificationById,
  createCertification,
  updateCertification,
  renewCertification,
  getSummary
} = require("../models/Certificate");

function getRouteParams(url) {
  const [, api, resource, id, action] = url.split("/");
  return { api, resource, id, action };
}

function handleCertificates(req, res, body, sendJson, urlObj) {
  const { id, action } = getRouteParams(urlObj.pathname);

  if (req.method === "GET" && urlObj.pathname === "/api/certifications") {
    const role = urlObj.searchParams.get("role") || "user";
    const userId = urlObj.searchParams.get("userId") || "";
    const status = urlObj.searchParams.get("status") || "All";

    sendJson(res, 200, {
      certifications: getCertifications({ role, userId, status }),
      summary: getSummary(role, userId)
    });
    return true;
  }

  if (req.method === "GET" && id && !action) {
    const certification = getCertificationById(id);
    if (!certification) {
      sendJson(res, 404, { message: "Certification not found." });
      return true;
    }

    sendJson(res, 200, { certification });
    return true;
  }

  if (req.method === "POST" && urlObj.pathname === "/api/certifications") {
    const requiredFields = ["userId", "userName", "title", "provider", "issueDate", "expiryDate", "certificateCode"];
    const missing = requiredFields.find((field) => !body[field]);

    if (missing) {
      sendJson(res, 400, { message: `Missing field: ${missing}` });
      return true;
    }

    sendJson(res, 201, {
      message: "Certification created successfully.",
      certification: createCertification(body)
    });
    return true;
  }

  if (req.method === "PUT" && id && !action) {
    const certification = updateCertification(id, body);
    if (!certification) {
      sendJson(res, 404, { message: "Certification not found." });
      return true;
    }

    sendJson(res, 200, {
      message: "Certification updated successfully.",
      certification
    });
    return true;
  }

  if (req.method === "POST" && id && action === "renew") {
    if (!body.expiryDate) {
      sendJson(res, 400, { message: "New expiry date is required for renewal." });
      return true;
    }

    const certification = renewCertification(id, body);
    if (!certification) {
      sendJson(res, 404, { message: "Certification not found." });
      return true;
    }

    sendJson(res, 200, {
      message: "Certification renewed successfully.",
      certification
    });
    return true;
  }

  return false;
}

module.exports = {
  handleCertificates
};
