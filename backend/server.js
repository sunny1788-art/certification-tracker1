const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { handleAuth } = require("./routes/authRoutes");
const { handleCertificates } = require("./routes/certRoutes");

const PORT = process.env.PORT || 3000;
const frontendDir = path.join(__dirname, "..", "frontend");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { message: "Resource not found." });
      return;
    }

    const extension = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extension] || "text/plain; charset=utf-8" });
    res.end(data);
  });
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk.toString();
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function resolveFrontendPath(urlPath) {
  if (urlPath === "/" || urlPath === "/index.html") {
    return path.join(frontendDir, "index.html");
  }

  if (urlPath === "/login" || urlPath === "/login.html") {
    return path.join(frontendDir, "login.html");
  }

  if (urlPath === "/dashboard" || urlPath === "/dashboard.html") {
    return path.join(frontendDir, "dashboard.html");
  }

  return path.join(frontendDir, urlPath.replace(/^\/+/, ""));
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (urlObj.pathname.startsWith("/api/")) {
    try {
      const body = req.method === "GET" ? {} : await collectBody(req);

      if (handleAuth(req, res, body, sendJson)) {
        return;
      }

      if (handleCertificates(req, res, body, sendJson, urlObj)) {
        return;
      }

      sendJson(res, 404, { message: "API route not found." });
    } catch (error) {
      sendJson(res, 400, { message: "Invalid request payload.", details: error.message });
    }
    return;
  }

  const filePath = resolveFrontendPath(urlObj.pathname);
  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Certification tracker running on http://localhost:${PORT}`);
});
