require("dotenv/config");
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

const app = express();
const PORT = process.env.PORT || 3001;

const origins = (process.env.CORS_ORIGINS || "*").split(",").map((s) => s.trim());
app.use(helmet());
app.use(cors({ origin: origins.includes("*") ? true : origins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", authRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/responses", responsesRouter);
app.use("/api/admins", adminsRouter);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[ReviewOS] API listening on :${PORT}`);
});
