/**
 * ReviewOS Plesk/iisnode startup file.
 *
 * Plesk on Windows loads the startup file with CommonJS require(), so this
 * file intentionally uses CommonJS even though the frontend project is ESM.
 */
require("dotenv/config");

const express = require("express");
const cors = require("cors");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

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
  console.warn("[startup] DB env vars missing; API will return 500s until DB_* are set in Plesk.");
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

// Run startup database migrations to ensure templates table columns exist
(async () => {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM templates LIKE 'display_mode'");
    if (cols.length === 0) {
      await pool.query("ALTER TABLE templates ADD COLUMN display_mode VARCHAR(64) DEFAULT 'multi_page'");
      console.log("[db] Added display_mode column to templates table.");
    }
    const [brandCols] = await pool.query("SHOW COLUMNS FROM templates LIKE 'branding'");
    if (brandCols.length === 0) {
      await pool.query("ALTER TABLE templates ADD COLUMN branding JSON NULL");
      console.log("[db] Added branding column to templates table.");
    }
  } catch (err) {
    console.error("[db] Startup migration failed:", err);
  }
})();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

const signDeviceToken = (device) =>
  jwt.sign({ type: "device", id: device.id, owner_id: device.owner_id }, JWT_SECRET, {
    expiresIn: "365d",
  });

function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return required ? res.status(401).json({ error: "No token" }) : next();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload?.type === "device") req.device = payload;
      else req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

const requireSuper = (req, res, next) =>
  req.user?.role === "super" ? next() : res.status(403).json({ error: "Super admin only" });

const deviceAuth = (req, res, next) =>
  req.device?.type === "device" ? next() : res.status(403).json({ error: "Device token required" });

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function createPairingCode(ownerId = null) {
  for (let i = 0; i < 8; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const [exist] = await pool.query(
      "SELECT code FROM device_pairing_codes WHERE code = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
      [code],
    );
    if (exist.length) continue;
    await pool.query(
      "INSERT INTO device_pairing_codes (code, owner_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
      [code, ownerId],
    );
    return { code, expires_in_seconds: 600 };
  }
  throw new Error("Could not generate code");
}

// ---------------- public tablet pairing ----------------
app.post(
  "/api/public/devices/request-code",
  asyncH(async (_req, res) => {
    res.json(await createPairingCode(null));
  }),
);

app.get(
  "/api/public/devices/pair-status",
  asyncH(async (req, res) => {
    const code = String(req.query.code || "")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (code.length !== 6) return res.status(400).json({ error: "6-digit code required" });
    const [rows] = await pool.query(
      `SELECT pc.code, pc.used_at, pc.expires_at, d.id, d.owner_id, d.name, d.location, d.template_id
       FROM device_pairing_codes pc
       LEFT JOIN devices d ON d.id = pc.device_id
       WHERE pc.code = ? LIMIT 1`,
      [code],
    );
    const row = rows[0];
    if (!row || (!row.used_at && new Date(row.expires_at).getTime() <= Date.now())) {
      return res.json({ paired: false, expired: true });
    }
    if (!row.used_at || !row.id) return res.json({ paired: false });
    const device = {
      id: row.id,
      owner_id: row.owner_id,
      name: row.name,
      location: row.location,
      template_id: row.template_id,
    };
    res.json({ paired: true, device_token: signDeviceToken(device), device });
  }),
);

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
    if (!u || u.status === "disabled")
      return res.status(401).json({ error: "Invalid credentials" });
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

app.get(
  "/api/templates",
  auth(),
  asyncH(async (_req, res) => {
    const [rows] = await pool.query(
      "SELECT id, name, description, category, status, questions, display_mode, branding, created_at, updated_at FROM templates ORDER BY id DESC",
    );
    res.json({
      templates: rows.map((t) => ({
        ...t,
        displayMode: t.display_mode,
        branding: parseJson(t.branding, null),
        questions: parseJson(t.questions, []),
      })),
    });
  }),
);

app.post(
  "/api/templates",
  auth(),
  asyncH(async (req, res) => {
    const {
      name,
      description = "",
      category = "General",
      status = "draft",
      questions = [],
      displayMode = "multi_page",
      branding = null,
    } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    const [r] = await pool.query(
      "INSERT INTO templates (owner_id, name, description, category, status, questions, display_mode, branding) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.user.id,
        name,
        description,
        category,
        status,
        JSON.stringify(questions),
        displayMode,
        JSON.stringify(branding),
      ],
    );
    res.json({ id: r.insertId });
  }),
);

app.get(
  "/api/templates/:id",
  auth(),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      "SELECT id, name, description, category, status, questions, display_mode, branding, created_at, updated_at FROM templates WHERE id = ? LIMIT 1",
      [id],
    );
    const template = rows[0];
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json({
      ...template,
      displayMode: template.display_mode,
      branding: parseJson(template.branding, null),
      questions: parseJson(template.questions, []),
    });
  }),
);

app.put(
  "/api/templates/:id",
  auth(),
  asyncH(async (req, res) => {
    const { name, description, category, status, questions, displayMode, branding } = req.body || {};
    await pool.query(
      "UPDATE templates SET name=?, description=?, category=?, status=?, questions=?, display_mode=?, branding=?, updated_at=NOW() WHERE id=?",
      [
        name,
        description,
        category,
        status,
        JSON.stringify(questions ?? []),
        displayMode || "multi_page",
        JSON.stringify(branding || null),
        Number(req.params.id),
      ],
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

app.get(
  "/api/devices/me",
  auth(),
  deviceAuth,
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, owner_id, name, location, status, android_version, last_sync, template_id, created_at FROM devices WHERE id = ? LIMIT 1",
      [req.device.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Device not found" });
    res.json(rows[0]);
  }),
);

app.post(
  "/api/devices/heartbeat",
  auth(),
  deviceAuth,
  asyncH(async (req, res) => {
    await pool.query("UPDATE devices SET last_sync = NOW(), status = 'online' WHERE id = ?", [
      req.device.id,
    ]);
    res.json({ ok: true });
  }),
);

app.get(
  "/api/devices",
  auth(),
  asyncH(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.location, d.status, d.android_version, d.last_sync,
              d.template_id,
              TIMESTAMPDIFF(SECOND, d.last_sync, NOW()) AS seconds_since_sync,
              (SELECT COUNT(*) FROM responses r WHERE r.device_id = d.id AND DATE(r.submitted_at) = CURDATE()) AS responses_today
       FROM devices d ORDER BY d.id DESC`,
    );
    const processedDevices = rows.map((d) => {
      let calcStatus = "offline";
      if (d.status === "paused") {
        calcStatus = "paused";
      } else if (d.seconds_since_sync !== null && d.seconds_since_sync <= 180) {
        calcStatus = "online";
      } else {
        calcStatus = "offline";
      }
      return {
        ...d,
        status: calcStatus,
        seconds_since_sync: undefined, // don't expose internal field to client
      };
    });
    res.json({ devices: processedDevices });
  }),
);


app.post(
  "/api/devices/pair",
  auth(),
  asyncH(async (req, res) => {
    const { code, name, location } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: "code and name required" });
    const normalizedCode = String(code).replace(/\D/g, "").slice(0, 6);
    const [codes] = await pool.query(
      `SELECT code, owner_id, used_at, expires_at FROM device_pairing_codes
       WHERE code = ? AND used_at IS NULL AND expires_at > NOW()
         AND (owner_id IS NULL OR owner_id = ?)
       LIMIT 1`,
      [normalizedCode, req.user.id],
    );
    if (!codes[0]) return res.status(404).json({ error: "Pairing code not found or expired" });
    const [r] = await pool.query(
      "INSERT INTO devices (owner_id, name, location, status, android_version, last_sync) VALUES (?, ?, ?, 'online', 'Android 14', NOW())",
      [req.user.id, name, location || null],
    );
    const device = {
      id: r.insertId,
      owner_id: req.user.id,
      name,
      location: location || null,
      template_id: null,
    };
    await pool.query(
      "UPDATE device_pairing_codes SET owner_id = ?, device_id = ?, used_at = NOW() WHERE code = ?",
      [req.user.id, r.insertId, normalizedCode],
    );
    res.json({ id: r.insertId, device_token: signDeviceToken(device) });
  }),
);

app.put(
  "/api/devices/:id/template",
  auth(),
  asyncH(async (req, res) => {
    const tid = req.body?.template_id ?? null;
    await pool.query("UPDATE devices SET template_id = ? WHERE id = ?", [
      tid,
      Number(req.params.id),
    ]);
    res.json({ ok: true });
  }),
);

app.put(
  "/api/devices/:id",
  auth(),
  asyncH(async (req, res) => {
    const { name, location, status } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    await pool.query("UPDATE devices SET name = ?, location = ?, status = ? WHERE id = ?", [
      name,
      location || null,
      status || "online",
      Number(req.params.id),
    ]);
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

app.post(
  "/api/responses",
  auth(),
  deviceAuth,
  asyncH(async (req, res) => {
    const { template_id, rating = null, answers = {}, duration_seconds = 0 } = req.body || {};
    if (!template_id) return res.status(400).json({ error: "template_id required" });
    await pool.query(
      "INSERT INTO responses (template_id, device_id, rating, answers, duration_seconds, submitted_at) VALUES (?, ?, ?, ?, ?, NOW())",
      [
        Number(template_id),
        req.device.id,
        rating,
        JSON.stringify(answers || {}),
        Number(duration_seconds) || 0,
      ],
    );
    await pool.query("UPDATE devices SET last_sync = NOW(), status = 'online' WHERE id = ?", [
      req.device.id,
    ]);
    res.json({ ok: true });
  }),
);

app.get(
  "/api/responses",
  auth(),
  asyncH(async (_req, res) => {
    const [rows] = await pool.query(
      `SELECT r.id, r.template_id, t.name AS template, t.questions AS template_questions, r.device_id, d.name AS device,
              r.rating, r.answers, r.submitted_at, r.duration_seconds
       FROM responses r
       LEFT JOIN templates t ON t.id = r.template_id
       LEFT JOIN devices d ON d.id = r.device_id
       ORDER BY r.submitted_at DESC LIMIT 500`,
    );
    res.json({
      responses: rows.map((r) => ({
        ...r,
        answers: parseJson(r.answers, {}),
        template_questions: parseJson(r.template_questions, []),
      })),
    });
  }),
);

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
    if (password.length < 8) return res.status(400).json({ error: "password must be >=8 chars" });
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
    if (!["active", "disabled"].includes(status))
      return res.status(400).json({ error: "bad status" });
    await pool.query("UPDATE users SET status = ? WHERE id = ?", [status, Number(req.params.id)]);
    res.json({ ok: true });
  }),
);

// ---------------- user profile (org + timezone) ----------------
app.get(
  "/api/profile",
  auth(),
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT organization, timezone, avatar_url FROM user_profiles WHERE user_id = ? LIMIT 1",
      [req.user.id],
    );
    res.json({ profile: rows[0] || { organization: null, timezone: "UTC", avatar_url: null } });
  }),
);

app.put(
  "/api/profile",
  auth(),
  asyncH(async (req, res) => {
    const { organization = null, timezone = "UTC", avatar_url = null } = req.body || {};
    await pool.query(
      `INSERT INTO user_profiles (user_id, organization, timezone, avatar_url)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE organization=VALUES(organization), timezone=VALUES(timezone), avatar_url=VALUES(avatar_url)`,
      [req.user.id, organization, timezone, avatar_url],
    );
    res.json({ ok: true });
  }),
);

// ---------------- update password ----------------
app.put(
  "/api/auth/password",
  auth(),
  asyncH(async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password)
      return res.status(400).json({ error: "current and new password required" });
    if (new_password.length < 8)
      return res.status(400).json({ error: "new password must be >=8 chars" });
    const [rows] = await pool.query("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [
      req.user.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const ok = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
    res.json({ ok: true });
  }),
);

// ---------------- notification preferences ----------------
app.get(
  "/api/notifications/prefs",
  auth(),
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT pref_key, enabled FROM notification_prefs WHERE user_id = ?",
      [req.user.id],
    );
    const prefs = {};
    for (const r of rows) prefs[r.pref_key] = !!r.enabled;
    res.json({ prefs });
  }),
);

app.put(
  "/api/notifications/prefs",
  auth(),
  asyncH(async (req, res) => {
    const { prefs } = req.body || {};
    if (!prefs || typeof prefs !== "object")
      return res.status(400).json({ error: "prefs object required" });
    const entries = Object.entries(prefs);
    if (entries.length === 0) return res.json({ ok: true });
    const values = entries.map(([k, v]) => [req.user.id, String(k).slice(0, 64), v ? 1 : 0]);
    await pool.query(
      `INSERT INTO notification_prefs (user_id, pref_key, enabled) VALUES ?
       ON DUPLICATE KEY UPDATE enabled=VALUES(enabled)`,
      [values],
    );
    res.json({ ok: true });
  }),
);

// ---------------- device pairing codes (6-digit) ----------------
app.post(
  "/api/devices/pairing-code",
  auth(),
  asyncH(async (req, res) => {
    res.json(await createPairingCode(req.user.id));
  }),
);

app.use("/api", (err, _req, res, _next) => {
  console.error("[api error]", err);
  res.status(500).json({ error: err.message || "Server error" });
});

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

module.exports = app;
