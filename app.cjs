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

    // Scheduling Module tables initialization
    const [tableExist] = await pool.query("SHOW TABLES LIKE 'schedules'");
    if (tableExist.length === 0) {
      console.log("[db] Initializing new schedules database tables...");
      
      // Drop legacy table if it exists
      await pool.query("DROP TABLE IF EXISTS device_schedules");
      
      // Create schedules parent table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schedules (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          device_id   INT NOT NULL,
          template_id INT NOT NULL,
          owner_id    INT NOT NULL,
          start_time  TIME NOT NULL,
          end_time    TIME NOT NULL,
          start_date  DATE NOT NULL,
          created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_schedules_device   FOREIGN KEY (device_id)   REFERENCES devices(id)   ON DELETE CASCADE,
          CONSTRAINT fk_schedules_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
          CONSTRAINT fk_schedules_owner    FOREIGN KEY (owner_id)    REFERENCES users(id)     ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Create schedule_recurrences table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schedule_recurrences (
          id              INT AUTO_INCREMENT PRIMARY KEY,
          schedule_id     INT NOT NULL UNIQUE,
          repeat_mode     ENUM('none', 'daily', 'custom') NOT NULL DEFAULT 'none',
          repeat_interval INT DEFAULT 1,
          days_count      INT DEFAULT 1,
          CONSTRAINT fk_recurrences_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Create schedule_instances table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schedule_instances (
          id              INT AUTO_INCREMENT PRIMARY KEY,
          schedule_id     INT NOT NULL,
          device_id       INT NOT NULL,
          template_id     INT NOT NULL,
          date            DATE NOT NULL,
          start_time      TIME NOT NULL,
          end_time        TIME NOT NULL,
          start_datetime  DATETIME NOT NULL,
          end_datetime    DATETIME NOT NULL,
          CONSTRAINT fk_instances_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
          CONSTRAINT fk_instances_device   FOREIGN KEY (device_id)   REFERENCES devices(id)   ON DELETE CASCADE,
          CONSTRAINT fk_instances_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Create index for fast device query
      await pool.query(`
        CREATE INDEX idx_instances_device_time ON schedule_instances (device_id, start_datetime, end_datetime);
      `);
      console.log("[db] Scheduling database tables initialized successfully.");
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

// ---------------- schedules ----------------

// Helper to generate instances for a schedule
function generateInstances(scheduleId, deviceId, templateId, startTime, endTime, startDate, repeatMode, repeatInterval = 1, daysCount = 1) {
  const instances = [];
  
  // Normalize startDate to YYYY-MM-DD string (handles string or JS Date object)
  let dateStrInput = "";
  if (startDate instanceof Date) {
    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, "0");
    const day = String(startDate.getDate()).padStart(2, "0");
    dateStrInput = `${y}-${m}-${day}`;
  } else if (typeof startDate === "string") {
    dateStrInput = startDate.slice(0, 10);
  } else {
    dateStrInput = String(startDate || "").slice(0, 10);
  }

  const baseDate = new Date(dateStrInput + "T00:00:00");
  
  let count = 1;
  if (repeatMode === "daily" || repeatMode === "custom") {
    count = daysCount || 1;
  }

  const interval = repeatMode === "custom" ? (repeatInterval || 1) : 1;

  for (let i = 0; i < count; i++) {
    const curDate = new Date(baseDate.getTime());
    curDate.setDate(baseDate.getDate() + i * interval);
    
    const y = curDate.getFullYear();
    const m = String(curDate.getMonth() + 1).padStart(2, "0");
    const d = String(curDate.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const startDatetimeStr = `${dateStr} ${startTime}`;
    const endDatetimeStr = `${dateStr} ${endTime}`;

    instances.push({
      schedule_id: scheduleId,
      device_id: deviceId,
      template_id: templateId,
      date: dateStr,
      start_time: startTime,
      end_time: endTime,
      start_datetime: startDatetimeStr,
      end_datetime: endDatetimeStr
    });
  }
  return instances;
}

// Helper to check overlaps in schedule_instances
async function checkOverlap(connection, deviceId, instances, ignoreScheduleId = null) {
  for (const inst of instances) {
    const query = ignoreScheduleId
      ? `SELECT i.id, t.name AS template_name, DATE_FORMAT(i.date,'%Y-%m-%d') AS date,
                TIME_FORMAT(i.start_time,'%H:%i') AS start_time, TIME_FORMAT(i.end_time,'%H:%i') AS end_time
         FROM schedule_instances i
         LEFT JOIN templates t ON t.id = i.template_id
         WHERE i.device_id = ? AND i.date = ? 
           AND i.start_time < ? AND i.end_time > ?
           AND i.schedule_id != ?
         LIMIT 1`
      : `SELECT i.id, t.name AS template_name, DATE_FORMAT(i.date,'%Y-%m-%d') AS date,
                TIME_FORMAT(i.start_time,'%H:%i') AS start_time, TIME_FORMAT(i.end_time,'%H:%i') AS end_time
         FROM schedule_instances i
         LEFT JOIN templates t ON t.id = i.template_id
         WHERE i.device_id = ? AND i.date = ? 
           AND i.start_time < ? AND i.end_time > ?
         LIMIT 1`;
    const params = ignoreScheduleId
      ? [deviceId, inst.date, inst.end_time, inst.start_time, ignoreScheduleId]
      : [deviceId, inst.date, inst.end_time, inst.start_time];
    const [rows] = await connection.query(query, params);
    if (rows.length > 0) {
      return {
        overlapping: true,
        date: inst.date,
        start_time: rows[0].start_time,
        end_time: rows[0].end_time,
        template_name: rows[0].template_name
      };
    }
  }
  return { overlapping: false };
}

// GET /api/schedules (Backward compatibility fallback)
app.get(
  "/api/schedules",
  auth(),
  asyncH(async (req, res) => {
    const deviceId = req.query.device_id ? Number(req.query.device_id) : null;
    const where = deviceId ? "WHERE s.device_id = ?" : "";
    const params = deviceId ? [deviceId] : [];
    const [rows] = await pool.query(
      `SELECT s.id, s.device_id, s.template_id, t.name AS template_name,
              TIME_FORMAT(s.start_time,'%H:%i') AS start_time,
              TIME_FORMAT(s.end_time,'%H:%i')   AS end_time,
              DATE_FORMAT(s.start_date,'%Y-%m-%d') AS start_date,
              r.repeat_mode, r.repeat_interval, r.days_count
       FROM schedules s
       LEFT JOIN templates t ON t.id = s.template_id
       LEFT JOIN schedule_recurrences r ON r.schedule_id = s.id
       ${where}
       ORDER BY s.start_date, s.start_time`,
      params
    );
    res.json({ schedules: rows });
  })
);

// GET /api/schedules/device/:deviceId (Main Scheduler endpoint)
app.get(
  "/api/schedules/device/:deviceId",
  auth(),
  asyncH(async (req, res) => {
    const deviceId = Number(req.params.deviceId);
    
    // Get schedules
    const [schedules] = await pool.query(
      `SELECT s.id, s.device_id, s.template_id, t.name AS template_name,
              TIME_FORMAT(s.start_time,'%H:%i') AS start_time,
              TIME_FORMAT(s.end_time,'%H:%i')   AS end_time,
              DATE_FORMAT(s.start_date,'%Y-%m-%d') AS start_date,
              r.repeat_mode, r.repeat_interval, r.days_count
       FROM schedules s
       LEFT JOIN templates t ON t.id = s.template_id
       LEFT JOIN schedule_recurrences r ON r.schedule_id = s.id
       WHERE s.device_id = ?`,
      [deviceId]
    );

    // Get instances
    const [instances] = await pool.query(
      `SELECT i.id, i.schedule_id, i.device_id, i.template_id, t.name AS template_name,
              DATE_FORMAT(i.date,'%Y-%m-%d') AS date,
              TIME_FORMAT(i.start_time,'%H:%i') AS start_time,
              TIME_FORMAT(i.end_time,'%H:%i')   AS end_time,
              DATE_FORMAT(i.start_datetime,'%Y-%m-%d %H:%i:%s') AS start_datetime,
              DATE_FORMAT(i.end_datetime,'%Y-%m-%d %H:%i:%s')   AS end_datetime
       FROM schedule_instances i
       LEFT JOIN templates t ON t.id = i.template_id
       WHERE i.device_id = ?`,
      [deviceId]
    );

    res.json({ schedules, instances });
  })
);

// POST /api/schedules
app.post(
  "/api/schedules",
  auth(),
  asyncH(async (req, res) => {
    const {
      device_id,
      template_id,
      start_time,
      end_time,
      start_date,
      repeat_mode = "none",
      repeat_interval = 1,
      days_count = 1
    } = req.body || {};

    if (!device_id || !template_id || !start_time || !end_time || !start_date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const formattedStartTime = start_time.length === 5 ? `${start_time}:00` : start_time;
    const formattedEndTime = end_time.length === 5 ? `${end_time}:00` : end_time;

    const todayStr = new Date().toISOString().slice(0, 10);
    if (start_date < todayStr) {
      return res.status(400).json({ error: "You cannot schedule on past dates" });
    }

    if (formattedStartTime >= formattedEndTime) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Proposed instances
      const proposedInstances = generateInstances(
        0,
        Number(device_id),
        Number(template_id),
        formattedStartTime,
        formattedEndTime,
        start_date,
        repeat_mode,
        Number(repeat_interval),
        Number(days_count)
      );

      // Check overlap
      const overlapResult = await checkOverlap(conn, Number(device_id), proposedInstances);
      if (overlapResult.overlapping) {
        await conn.rollback();
        return res.status(400).json({
          error: `Overlap detected on ${overlapResult.date} with existing schedule ${overlapResult.start_time} - ${overlapResult.end_time} (${overlapResult.template_name})`
        });
      }

      // Insert parent schedule
      const [scheduleRes] = await conn.query(
        `INSERT INTO schedules (device_id, template_id, owner_id, start_time, end_time, start_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [Number(device_id), Number(template_id), req.user.id, formattedStartTime, formattedEndTime, start_date]
      );
      const scheduleId = scheduleRes.insertId;

      // Insert recurrence configuration
      await conn.query(
        `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
         VALUES (?, ?, ?, ?)`,
         [scheduleId, repeat_mode, Number(repeat_interval), Number(days_count)]
      );

      // Save instances
      const instanceValues = proposedInstances.map((inst) => [
        scheduleId,
        inst.device_id,
        inst.template_id,
        inst.date,
        inst.start_time,
        inst.end_time,
        inst.start_datetime,
        inst.end_datetime
      ]);

      await conn.query(
        `INSERT INTO schedule_instances (schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime)
         VALUES ?`,
        [instanceValues]
      );

      await conn.commit();
      res.json({ ok: true, id: scheduleId, created_instances: instanceValues.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// PUT /api/schedules/:id
app.put(
  "/api/schedules/:id",
  auth(),
  asyncH(async (req, res) => {
    const scheduleId = Number(req.params.id);
    const {
      template_id,
      start_time,
      end_time,
      start_date,
      repeat_mode,
      repeat_interval,
      days_count
    } = req.body || {};

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [curr] = await conn.query("SELECT * FROM schedules WHERE id = ? LIMIT 1", [scheduleId]);
      if (curr.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Schedule not found" });
      }
      const s = curr[0];

      const deviceId = s.device_id;
      const tid = template_id !== undefined ? Number(template_id) : s.template_id;
      const st = start_time !== undefined ? start_time : s.start_time;
      const et = end_time !== undefined ? end_time : s.end_time;
      const sd = start_date !== undefined ? start_date : s.start_date;

      const formattedStartTime = st.length === 5 ? `${st}:00` : st;
      const formattedEndTime = et.length === 5 ? `${et}:00` : et;

      if (formattedStartTime >= formattedEndTime) {
        await conn.rollback();
        return res.status(400).json({ error: "End time must be after start time" });
      }

      // Validate date is not in the past
      let dateStrInput = "";
      if (sd instanceof Date) {
        const y = sd.getFullYear();
        const m = String(sd.getMonth() + 1).padStart(2, "0");
        const day = String(sd.getDate()).padStart(2, "0");
        dateStrInput = `${y}-${m}-${day}`;
      } else if (typeof sd === "string") {
        dateStrInput = sd.slice(0, 10);
      } else {
        dateStrInput = String(sd || "").slice(0, 10);
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      if (dateStrInput < todayStr) {
        await conn.rollback();
        return res.status(400).json({ error: "You cannot schedule on past dates" });
      }

      const [currRec] = await conn.query("SELECT * FROM schedule_recurrences WHERE schedule_id = ? LIMIT 1", [scheduleId]);
      const rec = currRec[0] || {};
      const rm = repeat_mode !== undefined ? repeat_mode : (rec.repeat_mode || "none");
      const ri = repeat_interval !== undefined ? Number(repeat_interval) : (rec.repeat_interval || 1);
      const dc = days_count !== undefined ? Number(days_count) : (rec.days_count || 1);

      // Generate proposed instances
      const proposedInstances = generateInstances(
        scheduleId,
        deviceId,
        tid,
        formattedStartTime,
        formattedEndTime,
        sd,
        rm,
        ri,
        dc
      );

      // Check overlap
      const overlapResult = await checkOverlap(conn, deviceId, proposedInstances, scheduleId);
      if (overlapResult.overlapping) {
        await conn.rollback();
        return res.status(400).json({
          error: `Overlap detected on ${overlapResult.date} with existing schedule ${overlapResult.start_time} - ${overlapResult.end_time} (${overlapResult.template_name})`
        });
      }

      // Update schedule metadata
      await conn.query(
        `UPDATE schedules SET template_id = ?, start_time = ?, end_time = ?, start_date = ?
         WHERE id = ?`,
        [tid, formattedStartTime, formattedEndTime, sd, scheduleId]
      );

      // Update recurrence config
      await conn.query(
        `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE repeat_mode = VALUES(repeat_mode), repeat_interval = VALUES(repeat_interval), days_count = VALUES(days_count)`,
        [scheduleId, rm, ri, dc]
      );

      // Clear and regenerate instances
      await conn.query("DELETE FROM schedule_instances WHERE schedule_id = ?", [scheduleId]);

      const instanceValues = proposedInstances.map((inst) => [
        scheduleId,
        inst.device_id,
        inst.template_id,
        inst.date,
        inst.start_time,
        inst.end_time,
        inst.start_datetime,
        inst.end_datetime
      ]);

      await conn.query(
        `INSERT INTO schedule_instances (schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime)
         VALUES ?`,
        [instanceValues]
      );

      await conn.commit();
      res.json({ ok: true, created_instances: instanceValues.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// POST /api/schedules/exception
app.post(
  "/api/schedules/exception",
  auth(),
  asyncH(async (req, res) => {
    const { schedule_id, date, start_time, end_time, template_id } = req.body || {};
    if (!schedule_id || !date || !start_time || !end_time || !template_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const formattedStartTime = start_time.length === 5 ? `${start_time}:00` : start_time;
    const formattedEndTime = end_time.length === 5 ? `${end_time}:00` : end_time;

    if (formattedStartTime >= formattedEndTime) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [curr] = await conn.query("SELECT * FROM schedules WHERE id = ? LIMIT 1", [schedule_id]);
      if (curr.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Schedule not found" });
      }
      const s = curr[0];

      // Find all other recurring schedules on this date for this device
      const [otherInstances] = await conn.query(
        `SELECT i.id as instance_id, i.schedule_id, i.template_id, i.start_time, i.end_time 
         FROM schedule_instances i
         JOIN schedules sch ON sch.id = i.schedule_id
         JOIN schedule_recurrences r ON r.schedule_id = sch.id
         WHERE i.device_id = ? AND i.date = ? AND i.schedule_id != ? AND r.repeat_mode != 'none'`,
        [s.device_id, date, s.id]
      );

      // Convert all other recurring schedule occurrences on this day to standalone schedules
      for (const inst of otherInstances) {
        await conn.query("DELETE FROM schedule_instances WHERE id = ?", [inst.instance_id]);

        const [newS] = await conn.query(
          `INSERT INTO schedules (device_id, template_id, owner_id, start_time, end_time, start_date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [s.device_id, inst.template_id, req.user.id, inst.start_time, inst.end_time, date]
        );

        await conn.query(
          `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
           VALUES (?, 'none', 1, 1)`,
          [newS.insertId]
        );

        await conn.query(
          `INSERT INTO schedule_instances (schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newS.insertId, s.device_id, inst.template_id, date, inst.start_time, inst.end_time, `${date} ${inst.start_time}`, `${date} ${inst.end_time}`]
        );
      }

      // Proposed instances
      const proposedInstances = [{
        schedule_id: 0,
        device_id: s.device_id,
        template_id: Number(template_id),
        date: date,
        start_time: formattedStartTime,
        end_time: formattedEndTime,
        start_datetime: `${date} ${formattedStartTime}`,
        end_datetime: `${date} ${formattedEndTime}`
      }];

      // Temporarily delete old instance to avoid overlap check self-conflict
      await conn.query("DELETE FROM schedule_instances WHERE schedule_id = ? AND date = ?", [s.id, date]);

      // Check overlap
      const overlapResult = await checkOverlap(conn, s.device_id, proposedInstances);
      if (overlapResult.overlapping) {
        await conn.rollback();
        return res.status(400).json({
          error: `Overlap detected on ${overlapResult.date} with existing schedule ${overlapResult.start_time} - ${overlapResult.end_time} (${overlapResult.template_name})`
        });
      }

      // Create new standalone schedule
      const [newScheduleRes] = await conn.query(
        `INSERT INTO schedules (device_id, template_id, owner_id, start_time, end_time, start_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.device_id, Number(template_id), req.user.id, formattedStartTime, formattedEndTime, date]
      );
      const newScheduleId = newScheduleRes.insertId;

      await conn.query(
        `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
         VALUES (?, 'none', 1, 1)`,
        [newScheduleId]
      );

      await conn.query(
        `INSERT INTO schedule_instances (schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newScheduleId, s.device_id, Number(template_id), date, formattedStartTime, formattedEndTime, `${date} ${formattedStartTime}`, `${date} ${formattedEndTime}`]
      );

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// DELETE /api/schedules/:id
app.delete(
  "/api/schedules/:id",
  auth(),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const { date } = req.query || {};

    if (date) {
      // Delete only the single date occurrence instance
      await pool.query("DELETE FROM schedule_instances WHERE schedule_id = ? AND date = ?", [id, date]);
    } else {
      // Cascade delete the entire parent schedule
      await pool.query("DELETE FROM schedules WHERE id = ?", [id]);
    }
    res.json({ ok: true });
  })
);

// POST /api/schedules/repeat
app.post(
  "/api/schedules/repeat",
  auth(),
  asyncH(async (req, res) => {
    const { schedule_id, repeat_mode, repeat_interval = 1, days_count = 1, start_time, end_time, overwrite = false } = req.body || {};
    if (!schedule_id || !repeat_mode) {
      return res.status(400).json({ error: "schedule_id and repeat_mode required" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [curr] = await conn.query("SELECT * FROM schedules WHERE id = ? LIMIT 1", [schedule_id]);
      if (curr.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: "Schedule not found" });
      }
      const s = curr[0];

      let st = s.start_time;
      let et = s.end_time;

      if (start_time && end_time) {
        st = start_time.length === 5 ? `${start_time}:00` : start_time;
        et = end_time.length === 5 ? `${end_time}:00` : end_time;
        if (st >= et) {
          await conn.rollback();
          return res.status(400).json({ error: "End time must be after start time" });
        }
        await conn.query("UPDATE schedules SET start_time = ?, end_time = ? WHERE id = ?", [st, et, schedule_id]);
      }

      // Validate date is not in the past
      let dateStrInput = "";
      const sd = s.start_date;
      if (sd instanceof Date) {
        const y = sd.getFullYear();
        const m = String(sd.getMonth() + 1).padStart(2, "0");
        const day = String(sd.getDate()).padStart(2, "0");
        dateStrInput = `${y}-${m}-${day}`;
      } else if (typeof sd === "string") {
        dateStrInput = sd.slice(0, 10);
      } else {
        dateStrInput = String(sd || "").slice(0, 10);
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      if (dateStrInput < todayStr) {
        await conn.rollback();
        return res.status(400).json({ error: "You cannot schedule on past dates" });
      }

      // Proposed instances
      const proposedInstances = generateInstances(
        s.id,
        s.device_id,
        s.template_id,
        st,
        et,
        dateStrInput,
        repeat_mode,
        Number(repeat_interval),
        Number(days_count)
      );

      if (overwrite) {
        for (const inst of proposedInstances) {
          await conn.query(
            `DELETE FROM schedule_instances 
             WHERE device_id = ? AND date = ? AND schedule_id != ? AND start_time < ? AND end_time > ?`,
            [s.device_id, inst.date, s.id, inst.end_time, inst.start_time]
          );
        }
        await conn.query(
          `DELETE s FROM schedules s
           LEFT JOIN schedule_instances i ON i.schedule_id = s.id
           WHERE s.device_id = ? AND i.id IS NULL`,
          [s.device_id]
        );
      }

      // Check overlap
      const overlapResult = await checkOverlap(conn, s.device_id, proposedInstances, s.id);
      if (overlapResult.overlapping) {
        await conn.rollback();
        return res.status(400).json({
          error: `Overlap detected on ${overlapResult.date} with existing schedule ${overlapResult.start_time} - ${overlapResult.end_time} (${overlapResult.template_name})`,
          has_overlap: true
        });
      }

      // Update recurrence config
      await conn.query(
        `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE repeat_mode = VALUES(repeat_mode), repeat_interval = VALUES(repeat_interval), days_count = VALUES(days_count)`,
        [s.id, repeat_mode, Number(repeat_interval), Number(days_count)]
      );

      // Clear and regenerate instances
      await conn.query("DELETE FROM schedule_instances WHERE schedule_id = ?", [s.id]);

      const instanceValues = proposedInstances.map((inst) => [
        s.id,
        inst.device_id,
        inst.template_id,
        inst.date,
        inst.start_time,
        inst.end_time,
        inst.start_datetime,
        inst.end_datetime
      ]);

      await conn.query(
        `INSERT INTO schedule_instances (schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime)
         VALUES ?`,
        [instanceValues]
      );

      await conn.commit();
      res.json({ ok: true, created_instances: instanceValues.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// POST /api/schedules/copy-day (Helper for copy operations)
app.post(
  "/api/schedules/copy-day",
  auth(),
  asyncH(async (req, res) => {
    const { device_id, source_date, target_dates = [], overwrite = false } = req.body || {};
    if (!device_id || !source_date || !Array.isArray(target_dates) || target_dates.length === 0)
      return res.status(400).json({ error: "device_id, source_date, target_dates[] required" });

    // Find all instances running on the source date
    const [src] = await pool.query(
      `SELECT template_id, start_time, end_time FROM schedule_instances
       WHERE device_id = ? AND date = ?`,
      [Number(device_id), source_date]
    );

    if (src.length === 0) return res.json({ ok: true, created: 0 });

    // Check for existing schedules on target dates if overwrite is not approved yet
    if (!overwrite) {
      const [existing] = await pool.query(
        `SELECT DISTINCT date FROM schedule_instances 
         WHERE device_id = ? AND date IN (?)`,
        [Number(device_id), target_dates]
      );
      if (existing.length > 0) {
        return res.json({
          ok: false,
          has_existing: true,
          existing_dates: existing.map(row => {
            const d = new Date(row.date);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const da = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${da}`;
          })
        });
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (overwrite) {
        // Delete all instances on target dates for this device
        await conn.query(
          `DELETE FROM schedule_instances WHERE device_id = ? AND date IN (?)`,
          [Number(device_id), target_dates]
        );
        // Clean up empty schedules
        await conn.query(
          `DELETE s FROM schedules s
           LEFT JOIN schedule_instances i ON i.schedule_id = s.id
           WHERE s.device_id = ? AND i.id IS NULL`,
          [Number(device_id)]
        );
      }

      let createdCount = 0;
      for (const targetDate of target_dates) {
        for (const row of src) {
          // Create a new parent schedule for this target day
          const [scheduleRes] = await conn.query(
            `INSERT INTO schedules (device_id, template_id, owner_id, start_time, end_time, start_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [Number(device_id), row.template_id, req.user.id, row.start_time, row.end_time, targetDate]
          );
          const scheduleId = scheduleRes.insertId;

          // Insert recurrence configuration
          await conn.query(
            `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
             VALUES (?, 'none', 1, 1)`,
             [scheduleId]
          );

          // Save instance
          const startDatetime = `${targetDate} ${row.start_time}`;
          const endDatetime = `${targetDate} ${row.end_time}`;
          await conn.query(
            `INSERT INTO schedule_instances (schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [scheduleId, Number(device_id), row.template_id, targetDate, row.start_time, row.end_time, startDatetime, endDatetime]
          );

          createdCount++;
        }
      }

      await conn.commit();
      res.json({ ok: true, created: createdCount });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// Tablet polling: returns the template the device should display right now
app.get(
  "/api/devices/me/active-template",
  auth(),
  deviceAuth,
  asyncH(async (req, res) => {
    const [drows] = await pool.query(
      "SELECT id, template_id FROM devices WHERE id = ? LIMIT 1",
      [req.device.id],
    );
    if (!drows[0]) return res.status(404).json({ error: "Device not found" });
    const fallback = drows[0].template_id;

    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const da = String(now.getDate()).padStart(2, "0");
    const today = `${y}-${mo}-${da}`;

    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const hhmm = `${hh}:${mi}:${ss}`;

    const [activeRows] = await pool.query(
      `SELECT template_id FROM schedule_instances
       WHERE device_id = ? AND date = ? AND start_time <= ? AND end_time > ?
       LIMIT 1`,
      [req.device.id, today, hhmm, hhmm]
    );

    const active = activeRows[0];
    res.json({
      template_id: active ? active.template_id : fallback,
      source: active ? "schedule" : "default"
    });
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
