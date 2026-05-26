import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authRouter } from "./src/routes/auth.js";
import { templatesRouter } from "./src/routes/templates.js";
import { devicesRouter } from "./src/routes/devices.js";
import { responsesRouter } from "./src/routes/responses.js";
import { adminsRouter } from "./src/routes/admins.js";
import { errorHandler } from "./src/middleware/error.js";

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
