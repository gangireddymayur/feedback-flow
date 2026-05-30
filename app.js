/**
 * ReviewOS — Plesk Node.js startup file.
 *
 * Serves:
 *   • /api/*  → JSON API backed by MariaDB
 *   • /*      → built Vite SPA from ./dist (with SPA fallback to index.html)
 *
 * Required env (set these in Plesk → Node.js → Environment variables):
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET
 *   PORT (Plesk usually injects this automatically)
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  JWT_SECRET = "change-me-in-plesk-env",
  PORT = 3000,
} = process.env;

if (!DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.warn("[startup] DB env vars missing — API will return 500s until DB_* are set in Plesk.");
}

const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: false,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------- helpers ----------
const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return required ? res.status(401).json({ error: "No token" }) : next();
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}
const requireSuper = (req, res, next) =>
  req.user?.role === "super" ? next() : res.status(403).json({ error: "Super admin only" });

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- auth ----------
app.post(
  "/api/auth/login",
  asyncH(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const [rows] = await pool.query(
      "SELECT id, name, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1",
      [email.trim().toLowerCase()],
    );
    const u = rows[0];
    if (!u || u.status === "disabled") return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const user = { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status };
    res.json({ token: signToken(user), user });
  }),
);

app.get(
  "/api/me",
  auth(),
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, name, email, role, status FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ user: rows[0] });
  }),
);

// ---------- templates ----------
app.get(
  "/api/templates",
  auth(),
  asyncH(async (_req, res) => {
    const [rows] = await pool.query(
      "SELECT id, name, description, category, status, questions, created_at, updated_at FROM templates ORDER BY id DESC",
    );
    res.json({
      templates: rows.map((t) => ({ ...t, questions: parseJson(t.questions, []) })),
    });
  }),
);

app.post(
  "/api/templates",
  auth(),
  asyncH(async (req, res) => {
    const { name, description = "", category = "General", status = "draft", questions = [] } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    const [r] = await pool.query(
      "INSERT INTO templates (owner_id, name, description, category, status, questions) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.id, name, description, category, status, JSON.stringify(questions)],
    );
    res.json({ id: r.insertId });
  }),
);

app.put(
  "/api/templates/:id",
  auth(),
  asyncH(async (req, res) => {
    const { name, description, category, status, questions } = req.body || {};
    await pool.query(
      "UPDATE templates SET name=?, description=?, category=?, status=?, questions=?, updated_at=NOW() WHERE id=?",
      [name, description, category, status, JSON.stringify(questions ?? []), Number(req.params.id)],
    );
    res.json({ ok: true });
  }),
);

app.delete(
  "/api/templates/:id",
  auth(),
  asyncH(async (req, res) => {
    await pool.query("DELETE FROM templates WHERE id = ?", [Number(req.params.id)]);
    res.json({ ok: true });
  }),
);

// ---------- devices ----------
app.get(
  "/api/devices",
  auth(),
  asyncH(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.location, d.status, d.android_version, d.last_sync, d.template_id,
              (SELECT COUNT(*) FROM responses r WHERE r.device_id = d.id AND DATE(r.submitted_at) = CURDATE()) AS responses_today
       FROM devices d ORDER BY d.id DESC`,
    );
    res.json({ devices: rows });
  }),
);

app.post(
  "/api/devices/pair",
  auth(),
  asyncH(async (req, res) => {
    const { code, name, location } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: "code and name required" });
    const [r] = await pool.query(
      "INSERT INTO devices (owner_id, name, location, status, android_version, last_sync) VALUES (?, ?, ?, 'online', 'Android 14', NOW())",
      [req.user.id, name, location || null],
    );
    res.json({ id: r.insertId });
  }),
);

app.put(
  "/api/devices/:id/template",
  auth(),
  asyncH(async (req, res) => {
    const tid = req.body?.template_id ?? null;
    await pool.query("UPDATE devices SET template_id = ? WHERE id = ?", [tid, Number(req.params.id)]);
    res.json({ ok: true });
  }),
);

app.delete(
  "/api/devices/:id",
  auth(),
  asyncH(async (req, res) => {
    await pool.query("DELETE FROM devices WHERE id = ?", [Number(req.params.id)]);
    res.json({ ok: true });
  }),
);

// ---------- responses ----------
app.get(
  "/api/responses",
  auth(),
  asyncH(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT r.id, r.template_id, t.name AS template, r.device_id, d.name AS device,
              r.rating, r.answers, r.submitted_at, r.duration_seconds
       FROM responses r
       LEFT JOIN templates t ON t.id = r.template_id
       LEFT JOIN devices d ON d.id = r.device_id
       ORDER BY r.submitted_at DESC LIMIT 500`,
    );
    res.json({
      responses: rows.map((r) => ({ ...r, answers: parseJson(r.answers, {}) })),
    });
  }),
);

// ---------- admins ----------
app.get(
  "/api/admins",
  auth(),
  requireSuper,
  asyncH(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
              (SELECT COUNT(*) FROM devices d WHERE d.owner_id = u.id) AS devices,
              (SELECT COUNT(*) FROM templates t WHERE t.owner_id = u.id) AS templates
       FROM users u ORDER BY u.id`,
    );
    res.json({ admins: rows });
  }),
);

app.post(
  "/api/admins",
  auth(),
  requireSuper,
  asyncH(async (req, res) => {
    const { name, email, password, role = "sub" } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (password.length < 8) return res.status(400).json({ error: "password must be ≥8 chars" });
    const hash = await bcrypt.hash(password, 10);
    try {
      const [r] = await pool.query(
        "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')",
        [name || email.split("@")[0], email.trim().toLowerCase(), hash, role],
      );
      res.json({ id: r.insertId });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email already exists" });
      throw e;
    }
  }),
);

app.put(
  "/api/admins/:id/status",
  auth(),
  requireSuper,
  asyncH(async (req, res) => {
    const { status } = req.body || {};
    if (!["active", "disabled"].includes(status)) return res.status(400).json({ error: "bad status" });
    await pool.query("UPDATE users SET status = ? WHERE id = ?", [status, Number(req.params.id)]);
    res.json({ ok: true });
  }),
);

// ---------- error handler ----------
app.use("/api", (err, _req, res, _next) => {
  console.error("[api error]", err);
  res.status(500).json({ error: err.message || "Server error" });
});

// ---------- static SPA ----------
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir, { maxAge: "1h", index: false }));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

function parseJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

app.listen(PORT, () => {
  console.log(`[ReviewOS] listening on :${PORT}`);
});
