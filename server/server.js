require("dotenv/config");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { authRouter } = require("./src/routes/auth.js");
const { templatesRouter } = require("./src/routes/templates.js");
const { devicesRouter } = require("./src/routes/devices.js");
const { responsesRouter } = require("./src/routes/responses.js");
const { adminsRouter } = require("./src/routes/admins.js");
const { errorHandler } = require("./src/middleware/error.js");
const { query } = require("./src/db.js");

const app = express();
const PORT = process.env.PORT || 3001;
const frontendClientDir = path.join(__dirname, "app-build", "client");
const frontendIndex = path.join(frontendClientDir, "index.html");
const hasFrontendBuild = fs.existsSync(frontendIndex);

const origins = (process.env.CORS_ORIGINS || "*").split(",").map((s) => s.trim());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // The Plesk preview URL uses HTTP until SSL is enabled.
        "upgrade-insecure-requests": null,
      },
    },
  }),
);
app.use(cors({ origin: origins.includes("*") ? true : origins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/interaction-test", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ReviewOS Interaction Test</title>
    <style>
      body { font: 16px Arial, sans-serif; padding: 40px; background: #fff; color: #111; }
      main { max-width: 520px; }
      input, button { display: block; width: 100%; box-sizing: border-box; margin: 14px 0; padding: 12px; font-size: 16px; }
      button { cursor: pointer; }
    </style>
  </head>
  <body>
    <main>
      <h1>Interaction test</h1>
      <p>This page contains no application JavaScript. Right-click this text, then type in the box.</p>
      <label for="typing">Typing test</label>
      <input id="typing" type="text" placeholder="Type here">
      <button type="button">Normal button</button>
    </main>
  </body>
</html>`);
});

app.get("/health", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, database: "ok", ts: Date.now() });
  } catch (error) {
    console.error("[ReviewOS] Database health check failed", error);
    res.status(503).json({ ok: false, database: "unavailable", ts: Date.now() });
  }
});

app.get("/api", (_req, res) => {
  res.json({
    service: "ReviewOS API",
    endpoints: {
      health: "GET /health",
      login: "POST /api/auth/login",
      me: "GET /api/auth/me",
      templates: "GET|POST /api/templates",
      devices: "GET /api/devices",
      pairDevice: "POST /api/devices/pair",
      responses: "GET /api/responses",
      admins: "GET|POST /api/admins",
    },
  });
});

app.use("/api/auth", authRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/responses", responsesRouter);
app.use("/api/admins", adminsRouter);

if (hasFrontendBuild) {
  app.use(express.static(frontendClientDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(frontendIndex);
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "ReviewOS API",
      health: "/health",
      docs: "/api",
      frontend:
        "Run npm run build:plesk and deploy server/app-build/client to show the dashboard here.",
    });
  });
}

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[ReviewOS] API listening on :${PORT}`);
});
