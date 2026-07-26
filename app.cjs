/**
 * ReviewOS Plesk/iisnode startup file.
 *
 * Plesk on Windows loads the startup file with CommonJS require(), so this
 * file intentionally uses CommonJS even though the frontend project is ESM.
 */
require("dotenv/config");

// Global Crash Logger to Desktop for Packaged Executable
if (process.pkg) {
  const fs = require("fs");
  const path = require("path");
  const crashLogPath = path.join(process.env.USERPROFILE || "", "Desktop", "reviewos-crash-log.txt");

  process.on("uncaughtException", (err) => {
    try {
      fs.writeFileSync(
        crashLogPath,
        `UNCAUGHT EXCEPTION\nDate: ${new Date().toISOString()}\nError: ${err.message}\nStack:\n${err.stack}\n`,
        "utf8"
      );
    } catch (e) {}
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    try {
      fs.writeFileSync(
        crashLogPath,
        `UNHANDLED REJECTION\nDate: ${new Date().toISOString()}\nReason: ${reason}\n`,
        "utf8"
      );
    } catch (e) {}
    process.exit(1);
  });
}

const express = require("express");
const cors = require("cors");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
  DB_HOST = "localhost",
  DB_PORT = "3306",
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  JWT_SECRET = "change-me-in-plesk-env",
  PORT = 3000,
  NODE_ENV,
} = process.env;

const CLOUD_URL = process.env.CLOUD_URL || "https://exciting-greider.103-69-196-157.plesk.page";

// The Windows local server keeps the current sign-in password in memory only.
// It is used exclusively when the signed-in admin explicitly refreshes their
// cloud device entitlement. Restarting the server clears this map.
const localLoginPasswords = new Map();

if (NODE_ENV === "production" && JWT_SECRET === "change-me-in-plesk-env") {
  console.error("FATAL ERROR: Environment variable JWT_SECRET is unset or insecure in production mode!");
  process.exit(1);
}

function translateSqlQuery(sql) {
  let s = sql;
  s = s.replace(/DATE_ADD\(NOW\(\),\s*INTERVAL\s*10\s*MINUTE\)/gi, "datetime('now', '+10 minutes')");
  s = s.replace(/TIMESTAMPDIFF\(SECOND,\s*d\.last_sync,\s*NOW\(\)\)/gi, "CAST((julianday('now') - julianday(d.last_sync)) * 86400 AS INTEGER)");
  s = s.replace(/CURDATE\(\)/gi, "date('now')");
  s = s.replace(/NOW\(\)/gi, "datetime('now')");
  s = s.replace(/ON DUPLICATE KEY UPDATE/gi, "ON CONFLICT DO UPDATE SET");
  s = s.replace(/VALUES\((\w+)\)/gi, "excluded.$1");
  // MySQL → SQLite date/time formatting functions
  // DATE_FORMAT(col, '%Y-%m-%d %H:%i:%s') → strftime('%Y-%m-%d %H:%M:%S', col)
  s = s.replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m-%d %H:%i:%s'\)/gi, "strftime('%Y-%m-%d %H:%M:%S', $1)");
  // DATE_FORMAT(col, '%Y-%m-%d') → strftime('%Y-%m-%d', col)
  s = s.replace(/DATE_FORMAT\(([^,]+),\s*'%Y-%m-%d'\)/gi, "strftime('%Y-%m-%d', $1)");
  // TIME_FORMAT(col, '%H:%i') → strftime('%H:%M', col)
  s = s.replace(/TIME_FORMAT\(([^,]+),\s*'%H:%i'\)/gi, "strftime('%H:%M', $1)");
  return s;
}

class SqlitePool {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.SQL = null;
    this.db = null;
    this.inTransaction = false;
    this.isSqlite = true;
    this.initPromise = this.init();
  }

  async init() {
    const initSqlJs = require("sql.js");
    const fs = require("node:fs");
    const path = require("node:path");
    
    // Load WebAssembly binary from node_modules inside package snapshot
    // `__dirname` points into pkg's read-only snapshot in the Windows build,
    // where the wasm asset is bundled. The second path supports normal Node runs.
    const wasmCandidates = [
      path.join(__dirname, "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    ];
    const wasmPath = wasmCandidates.find((candidate) => fs.existsSync(candidate));
    if (!wasmPath) {
      throw new Error(`sql.js WebAssembly asset was not found. Checked: ${wasmCandidates.join(", ")}`);
    }
    const wasmBinary = fs.readFileSync(wasmPath);

    this.SQL = await initSqlJs({ wasmBinary: wasmBinary });
    
    if (fs.existsSync(this.dbPath)) {
      const filebuffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(filebuffer);
    } else {
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      this.db = new this.SQL.Database();
      if (!this.inTransaction) this.saveToDisk();
    }
    
    // Enable PRAGMAs
    try {
      this.db.run("PRAGMA foreign_keys=ON;");
    } catch (e) {}
  }

  saveToDisk() {
    const fs = require("node:fs");
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  async execute(sql, params = []) {
    return this.query(sql, params);
  }

  async query(sql, params = []) {
    await this.initPromise;
    const originalSql = sql.trim();
    
    // Intercept "SHOW COLUMNS FROM <table> LIKE '<col>'"
    const showColumnsMatch = originalSql.match(/SHOW COLUMNS FROM\s+(\w+)\s+LIKE\s+'(\w+)'/i);
    if (showColumnsMatch) {
      const table = showColumnsMatch[1];
      const col = showColumnsMatch[2];
      try {
        const stmt = this.db.prepare(`PRAGMA table_info(${table})`);
        const rows = [];
        while (stmt.step()) {
          const rowVal = stmt.get();
          rows.push({ name: rowVal[1] });
        }
        stmt.free();
        const found = rows.some(r => r.name.toLowerCase() === col.toLowerCase());
        return [found ? [{ Field: col }] : [], null];
      } catch (err) {
        throw err;
      }
    }

    // Intercept "SHOW TABLES LIKE '<name>'"
    const showTablesMatch = originalSql.match(/SHOW TABLES LIKE\s+'(\w+)'/i);
    if (showTablesMatch) {
      const table = showTablesMatch[1];
      try {
        const stmt = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`);
        stmt.bind([table]);
        const rows = [];
        while (stmt.step()) {
          const rowVal = stmt.get();
          rows.push({ name: rowVal[0] });
        }
        stmt.free();
        return [rows.length > 0 ? [{ [`Tables_in_${table}`]: table }] : [], null];
      } catch (err) {
        throw err;
      }
    }

    const translatedSql = translateSqlQuery(sql);

    // Handle MySQL-style bulk INSERT: "INSERT INTO t (...) VALUES ?" with params=[[[row1],[row2],...]]
    if (
      Array.isArray(params) &&
      params.length === 1 &&
      Array.isArray(params[0]) &&
      params[0].length > 0 &&
      Array.isArray(params[0][0])
    ) {
      const rows = params[0];
      const colCount = rows[0].length;
      const placeholder = `(${Array(colCount).fill("?").join(",")})`;
      const singleRowSql = translatedSql.replace(/VALUES\s+\?/i, `VALUES ${placeholder}`);
      
      let lastId = 0;
      let changes = 0;
      
      for (const row of rows) {
        try {
          const stmt = this.db.prepare(singleRowSql);
          stmt.run(row);
          stmt.free();
          
          const res = this.db.exec("SELECT last_insert_rowid(), changes()");
          if (res && res.length > 0) {
            lastId = res[0].values[0][0];
            changes += res[0].values[0][1];
          }
        } catch (err) {
          throw err;
        }
      }
      
      if (!this.inTransaction) this.saveToDisk();
      return [{ insertId: lastId, affectedRows: changes }, null];
    }

    // Regular query
    try {
      let rows = [];
      const stmt = this.db.prepare(translatedSql);
      stmt.bind(params);
      
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const rowVal = stmt.get();
        const rowObj = {};
        columns.forEach((col, idx) => {
          rowObj[col] = rowVal[idx];
        });
        rows.push(rowObj);
      }
      stmt.free();
      
      const isWrite = /^\s*(insert|update|delete|create|drop|alter|replace)/i.test(translatedSql);
      if (isWrite) {
        let lastId = 0;
        let changes = 0;
        const res = this.db.exec("SELECT last_insert_rowid(), changes()");
        if (res && res.length > 0) {
          lastId = res[0].values[0][0];
          changes = res[0].values[0][1];
        }
        if (!this.inTransaction) this.saveToDisk();
        return [{ insertId: lastId, affectedRows: changes }, null];
      }
      
      return [rows, null];
    } catch (err) {
      throw err;
    }
  }

  async getConnection() {
    return {
      query: (sql, params) => this.query(sql, params),
      execute: (sql, params) => this.execute(sql, params),
      beginTransaction: async () => {
        await this.initPromise;
        this.db.run("BEGIN TRANSACTION");
        this.inTransaction = true;
      },
      commit: async () => {
        if (!this.inTransaction) return;
        this.db.run("COMMIT");
        this.inTransaction = false;
        this.saveToDisk();
      },
      rollback: async () => {
        if (!this.inTransaction) return;
        this.db.run("ROLLBACK");
        this.inTransaction = false;
      },
      release: () => {},
      isSqlite: true
    };
  }
}

const crypto = require("crypto");
const BACKUP_ENCRYPTION_KEY = crypto.createHash("sha256").update("reviewos-secure-backup-key-9a8b7c").digest();
const IV_LENGTH = 16;

function encryptBackup(payload) {
  const text = JSON.stringify(payload);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", BACKUP_ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptBackup(encryptedData) {
  const parts = encryptedData.split(":");
  if (parts.length !== 2) throw new Error("Invalid backup format");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = Buffer.from(parts[1], "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", BACKUP_ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

async function restoreBackupPayload(payload, dbPool) {
  const isSqliteDb = dbPool.isSqlite || useSqlite;
  
  const tablesToClear = isSqliteDb
    ? ["templates", "schedules", "schedule_recurrences", "schedule_instances", "screensavers", "user_profiles"]
    : ["users", "user_profiles", "templates", "devices", "screensavers", "schedules", "schedule_recurrences", "schedule_instances", "responses"];

  for (const table of tablesToClear) {
    try {
      await dbPool.query(`DELETE FROM ${table}`);
    } catch (e) {}
  }

  if (Array.isArray(payload.users)) {
    for (const u of payload.users) {
      await dbPool.query(
        "INSERT OR REPLACE INTO users (id, name, email, password_hash, role, status, local_mode, max_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [u.id, u.name, u.email, u.password_hash, u.role, u.status || "active", u.local_mode || "none", u.max_devices || 1]
      );
    }
  }

  if (payload.profile) {
    const p = payload.profile;
    await dbPool.query(
      "INSERT OR REPLACE INTO user_profiles (user_id, organization, timezone, avatar_url, show_brand_header, brand_header_placement) VALUES (?, ?, ?, ?, ?, ?)",
      [p.user_id || payload.users?.[0]?.id || 1, p.organization, p.timezone || "IST", p.avatar_url, p.show_brand_header || 0, p.brand_header_placement || "top"]
    );
  }

  if (Array.isArray(payload.templates)) {
    for (const t of payload.templates) {
      const qStr = typeof t.questions === "string" ? t.questions : JSON.stringify(t.questions || []);
      const bStr = typeof t.branding === "string" ? t.branding : JSON.stringify(t.branding || null);
      await dbPool.query(
        "INSERT OR REPLACE INTO templates (id, owner_id, name, description, category, status, questions, display_mode, branding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [t.id, t.owner_id, t.name, t.description || "", t.category || "General", t.status || "draft", qStr, t.display_mode || "multi_page", bStr]
      );
    }
  }

  if (Array.isArray(payload.devices)) {
    for (const d of payload.devices) {
      await dbPool.query(
        "INSERT OR REPLACE INTO devices (id, owner_id, name, location, status, android_version, template_id, schedules_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [d.id, d.owner_id, d.name, d.location || "", d.status || "offline", d.android_version || "", d.template_id, d.schedules_enabled ?? 1]
      );
    }
  }

  if (Array.isArray(payload.screensavers)) {
    for (const s of payload.screensavers) {
      await dbPool.query(
        "INSERT OR REPLACE INTO screensavers (id, owner_id, name, url, type, is_active, timeout_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [s.id, s.owner_id, s.name, s.url, s.type || "image", s.is_active || 0, s.timeout_seconds || 300]
      );
    }
  }

  if (Array.isArray(payload.schedules)) {
    for (const s of payload.schedules) {
      await dbPool.query(
        "INSERT OR REPLACE INTO schedules (id, device_id, template_id, owner_id, start_time, end_time, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [s.id, s.device_id, s.template_id, s.owner_id, s.start_time, s.end_time, s.start_date]
      );
    }
  }

  if (Array.isArray(payload.recurrences)) {
    for (const r of payload.recurrences) {
      await dbPool.query(
        "INSERT OR REPLACE INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count) VALUES (?, ?, ?, ?)",
        [r.schedule_id, r.repeat_mode || "none", r.repeat_interval || 1, r.days_count || 1]
      );
    }
  }

  if (Array.isArray(payload.instances)) {
    for (const i of payload.instances) {
      await dbPool.query(
        "INSERT OR REPLACE INTO schedule_instances (schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [i.schedule_id, i.device_id, i.template_id, i.date, i.start_time, i.end_time, i.start_datetime, i.end_datetime]
      );
    }
  }

  if (Array.isArray(payload.responses)) {
    for (const r of payload.responses) {
      const aStr = typeof r.answers === "string" ? r.answers : JSON.stringify(r.answers || {});
      await dbPool.query(
        "INSERT OR REPLACE INTO responses (id, template_id, device_id, rating, answers, duration_seconds, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [r.id, r.template_id, r.device_id, r.rating, aStr, r.duration_seconds || 0, r.submitted_at]
      );
    }
  }
}

async function autoRestoreBackup(backupPath, dbPool) {
  const fs = require("node:fs");
  try {
    if (!fs.existsSync(backupPath)) return;
    console.log(`[backup] Found auto-restore file at: ${backupPath}. Restoring database...`);
    const content = fs.readFileSync(backupPath, "utf8").trim();
    let payload;
    if (content.startsWith("{") || content.startsWith("[")) {
      payload = JSON.parse(content);
    } else {
      console.log("[backup] File is encrypted. Decrypting...");
      payload = decryptBackup(content);
    }
    
    await restoreBackupPayload(payload, dbPool);

    console.log("[backup] Database auto-restore completed successfully!");
    
    try {
      fs.unlinkSync(backupPath);
      console.log("[backup] Deleted backup.json after successful restore.");
    } catch (e) {
      console.error("[backup] Error deleting backup.json:", e.message);
    }
  } catch (err) {
    console.error("[backup] Auto-restore database failed:", err);
  }
}

async function initializeSqliteDb(sqlitePool) {
  try {
    await sqlitePool.execute("ALTER TABLE users ADD COLUMN local_mode TEXT NOT NULL DEFAULT 'none'");
  } catch (e) {}
  try {
    await sqlitePool.execute("ALTER TABLE users ADD COLUMN max_devices INTEGER DEFAULT 1");
  } catch (e) {}
  try {
    await sqlitePool.execute("ALTER TABLE users ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial'");
  } catch (e) {}
  try {
    await sqlitePool.execute("ALTER TABLE users ADD COLUMN trial_ends_at TEXT NULL");
  } catch (e) {}

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'sub',
      status        TEXT NOT NULL DEFAULT 'active',
      subscription_status TEXT NOT NULL DEFAULT 'trial',
      trial_ends_at TEXT NULL,
      local_mode    TEXT NOT NULL DEFAULT 'none',
      max_devices   INTEGER DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS templates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id    INTEGER NULL,
      name        TEXT NOT NULL,
      description TEXT,
      category    TEXT DEFAULT 'General',
      status      TEXT NOT NULL DEFAULT 'draft',
      questions   TEXT NOT NULL,
      display_mode TEXT DEFAULT 'multi_page',
      branding    TEXT NULL,
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS devices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id        INTEGER NULL,
      name            TEXT NOT NULL,
      location        TEXT,
      status          TEXT NOT NULL DEFAULT 'offline',
      android_version TEXT,
      last_sync       TEXT NULL,
      template_id     INTEGER NULL,
      schedules_enabled INTEGER DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS device_pairing_codes (
      code       TEXT PRIMARY KEY,
      owner_id   INTEGER NULL,
      device_id  INTEGER NULL,
      expires_at TEXT NOT NULL,
      used_at    TEXT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS responses (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id      INTEGER NULL,
      device_id        INTEGER NULL,
      rating           INTEGER NULL,
      answers          TEXT,
      duration_seconds INTEGER DEFAULT 0,
      submitted_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS schedules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id   INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      owner_id    INTEGER NOT NULL,
      start_time  TEXT NOT NULL,
      end_time    TEXT NOT NULL,
      start_date  TEXT NOT NULL,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at  TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS schedule_recurrences (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id     INTEGER NOT NULL UNIQUE,
      repeat_mode     TEXT NOT NULL DEFAULT 'none',
      repeat_interval INTEGER DEFAULT 1,
      days_count      INTEGER DEFAULT 1,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS schedule_instances (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id     INTEGER NOT NULL,
      device_id       INTEGER NOT NULL,
      template_id     INTEGER NOT NULL,
      date            TEXT NOT NULL,
      start_time      TEXT NOT NULL,
      end_time        TEXT NOT NULL,
      start_datetime  TEXT NOT NULL,
      end_datetime    TEXT NOT NULL,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS screensavers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id        INTEGER NOT NULL,
      name            TEXT NOT NULL,
      url             TEXT NOT NULL,
      type            TEXT NOT NULL DEFAULT 'image',
      is_active       INTEGER DEFAULT 0,
      timeout_seconds INTEGER DEFAULT 300,
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS user_profiles (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id                 INTEGER NOT NULL UNIQUE,
      organization            TEXT,
      timezone                TEXT DEFAULT 'UTC',
      avatar_url              TEXT,
      show_brand_header       INTEGER DEFAULT 0,
      brand_header_placement  TEXT DEFAULT 'top',
      created_at              TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  ];

  for (const sql of tables) {
    await sqlitePool.query(sql);
  }

  // Older local databases were created without this profile field.
  try {
    await sqlitePool.execute("ALTER TABLE user_profiles ADD COLUMN timezone TEXT DEFAULT 'UTC'");
  } catch (e) {}

  // Repair orphaned schedule data left by older builds whose SQLite
  // transaction wrapper persisted partial writes before rolling back.
  await sqlitePool.execute(
    "DELETE FROM schedule_instances WHERE schedule_id NOT IN (SELECT id FROM schedules)"
  );
  await sqlitePool.execute(
    "DELETE FROM schedule_recurrences WHERE schedule_id NOT IN (SELECT id FROM schedules)"
  );

}

let pool;
const useSqlite = process.env.USE_SQLITE === "true" || !DB_USER || !DB_PASSWORD || !DB_NAME;

const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;

// One-Click Self-Installer for Windows Executable (with GUI wizard dialogs)
if (process.pkg && process.platform === "win32") {
  try {
    const fs = require("fs");
    const path = require("path");
    
    const installDir = path.join(process.env.LOCALAPPDATA || "", "Programs", "ReviewOS Local Server");
    const targetExe = path.join(installDir, "local-server.exe");
    const currentExe = process.execPath;
    
    if (path.resolve(currentExe).toLowerCase() !== path.resolve(targetExe).toLowerCase()) {
      const { execSync } = require("child_process");
      
      // 1. Show GUI Install Dialog using Windows Forms (native .NET on Windows)
      const welcomeScript = `
        Add-Type -AssemblyName System.Windows.Forms;
        Add-Type -AssemblyName System.Drawing;
        $Form = New-Object System.Windows.Forms.Form;
        $Form.Text = 'ReviewOS Local Server Setup';
        $Form.Size = New-Object System.Drawing.Size(420, 240);
        $Form.StartPosition = 'CenterScreen';
        $Form.FormBorderStyle = 'FixedDialog';
        $Form.MaximizeBox = $false;
        $Form.MinimizeBox = $false;
        $Form.TopMost = $true;
        
        $Label = New-Object System.Windows.Forms.Label;
        $Label.Location = New-Object System.Drawing.Point(25, 25);
        $Label.Size = New-Object System.Drawing.Size(360, 80);
        $Label.Font = New-Object System.Drawing.Font('Segoe UI', 10);
        $Label.Text = 'Welcome to the ReviewOS Local Server Setup Wizard.\n\nThis will install the local database runner and administration dashboard on your computer.\n\nClick Install to continue.';
        
        $InstallBtn = New-Object System.Windows.Forms.Button;
        $InstallBtn.Location = New-Object System.Drawing.Point(210, 130);
        $InstallBtn.Size = New-Object System.Drawing.Size(85, 32);
        $InstallBtn.Font = New-Object System.Drawing.Font('Segoe UI', 9);
        $InstallBtn.Text = 'Install';
        $InstallBtn.DialogResult = [System.Windows.Forms.DialogResult]::OK;
        
        $CancelBtn = New-Object System.Windows.Forms.Button;
        $CancelBtn.Location = New-Object System.Drawing.Point(305, 130);
        $CancelBtn.Size = New-Object System.Drawing.Size(85, 32);
        $CancelBtn.Font = New-Object System.Drawing.Font('Segoe UI', 9);
        $CancelBtn.Text = 'Cancel';
        $CancelBtn.DialogResult = [System.Windows.Forms.DialogResult]::Cancel;
        
        $Form.Controls.Add($Label);
        $Form.Controls.Add($InstallBtn);
        $Form.Controls.Add($CancelBtn);
        $Form.AcceptButton = $InstallBtn;
        $Form.CancelButton = $CancelBtn;
        
        $Result = $Form.ShowDialog();
        if ($Result -eq [System.Windows.Forms.DialogResult]::OK) { exit 0 } else { exit 1 }
      `;

      try {
        execSync(`powershell -NoProfile -Command "${welcomeScript.replace(/\n/g, ' ')}"`);
      } catch (guiErr) {
        // User clicked Cancel or closed the installer window
        process.exit(0);
      }
      
      // 2. Create install directory
      if (!fs.existsSync(installDir)) {
        fs.mkdirSync(installDir, { recursive: true });
      }
      
      // 3. Copy executable
      try {
        fs.copyFileSync(currentExe, targetExe);
      } catch (copyErr) {
        // Safe bypass if file in use/overwrite fails
      }
      
      // 4. Create desktop and start menu shortcuts in-memory using PowerShell (100% immune to file-write antivirus flags)
      const shortcutScript = `
        $w = New-Object -ComObject WScript.Shell;
        $desktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'ReviewOS Local Server.lnk');
        $s1 = $w.CreateShortcut($desktopPath);
        $s1.TargetPath = '${targetExe.replace(/'/g, "''")}';
        $s1.WorkingDirectory = '${installDir.replace(/'/g, "''")}';
        $s1.Description = 'ReviewOS Local Server';
        $s1.Save();
        
        $startMenuPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Programs'), 'ReviewOS Local Server.lnk');
        $s2 = $w.CreateShortcut($startMenuPath);
        $s2.TargetPath = '${targetExe.replace(/'/g, "''")}';
        $s2.WorkingDirectory = '${installDir.replace(/'/g, "''")}';
        $s2.Description = 'ReviewOS Local Server';
        $s2.Save();
      `;
      try {
        execSync(`powershell -NoProfile -Command "${shortcutScript.replace(/\n/g, ' ')}"`);
      } catch (err) {
        console.error("[install] In-memory shortcut generation failed:", err.message);
      }
      
      // 5. Show Finish Confirmation GUI Message Box
      const finishScript = `
        Add-Type -AssemblyName System.Windows.Forms;
        [System.Windows.Forms.MessageBox]::Show('ReviewOS Local Server has been installed successfully!\n\nA desktop shortcut has been created.\n\nClick OK to start the server and open the browser dashboard.', 'Installation Complete', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information);
      `;
      try {
        execSync(`powershell -NoProfile -Command "${finishScript.replace(/\n/g, ' ')}"`);
      } catch (e) {}

      // 6. Launch installed target detached in background
      const { spawn } = require("child_process");
      const child = spawn(targetExe, [], {
        detached: true,
        stdio: "ignore",
        cwd: installDir,
        env: process.env
      });
      child.unref();
      
      process.exit(0);
    }
  } catch (shErr) {
    // Fail-safe boot on any installer faults
  }
}

if (useSqlite) {
  console.log("[startup] Using local SQLite database file configuration...");
  const fs = require("node:fs");
  const dbDir = path.join(baseDir, "db");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, "feedback.sqlite");
  pool = new SqlitePool(dbPath);
} else {
  const mysql = require("mysql2/promise");
  pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: false,
  });
}

// Run startup database migrations to ensure templates table columns exist
(async () => {
  try {
    if (useSqlite) {
      await initializeSqliteDb(pool);
      // Auto-restore database backup on startup if backup.json exists in directory
      const fs = require("node:fs");
      const path = require("node:path");
      const candidates = [
        path.join(baseDir, "backup.json"),
        path.join(process.cwd(), "backup.json")
      ];
      const foundPath = candidates.find(p => fs.existsSync(p));
      if (foundPath) {
        await autoRestoreBackup(foundPath, pool);
      }
    }
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

    const [profileTableExist] = await pool.query("SHOW TABLES LIKE 'user_profiles'");
    if (profileTableExist.length > 0) {
      const [profileTableCols] = await pool.query("SHOW COLUMNS FROM user_profiles LIKE 'show_brand_header'");
      if (profileTableCols.length === 0) {
        await pool.query("ALTER TABLE user_profiles ADD COLUMN show_brand_header TINYINT(1) DEFAULT 0");
        console.log("[db] Added show_brand_header column to user_profiles table.");
      }
      const [placementCols] = await pool.query("SHOW COLUMNS FROM user_profiles LIKE 'brand_header_placement'");
      if (placementCols.length === 0) {
        await pool.query("ALTER TABLE user_profiles ADD COLUMN brand_header_placement VARCHAR(10) DEFAULT 'top'");
        console.log("[db] Added brand_header_placement column to user_profiles table.");
      }
    }

    const [devCols] = await pool.query("SHOW COLUMNS FROM devices LIKE 'schedules_enabled'");
    if (devCols.length === 0) {
      await pool.query("ALTER TABLE devices ADD COLUMN schedules_enabled TINYINT(1) DEFAULT 1");
      console.log("[db] Added schedules_enabled column to devices table.");
    }

    const [userModeCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'local_mode'");
    if (userModeCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN local_mode VARCHAR(32) DEFAULT 'none'");
      console.log("[db] Added local_mode column to users table.");
    }
    const [userMaxCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'max_devices'");
    if (userMaxCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN max_devices INT DEFAULT 1");
      console.log("[db] Added max_devices column to users table.");
    }
    const [userSubCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'subscription_status'");
    if (userSubCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN subscription_status VARCHAR(32) DEFAULT 'trial'");
      console.log("[db] Added subscription_status column to users table.");
    }
    const [userTrialCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'trial_ends_at'");
    if (userTrialCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN trial_ends_at DATETIME NULL");
      console.log("[db] Added trial_ends_at column to users table.");
    }

    // Screensavers Table initialization
    const [screensaversExist] = await pool.query("SHOW TABLES LIKE 'screensavers'");
    if (screensaversExist.length === 0) {
      console.log("[db] Initializing screensavers database table...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS screensavers (
          id              INT AUTO_INCREMENT PRIMARY KEY,
          owner_id        INT NOT NULL,
          name            VARCHAR(255) NOT NULL,
          url             VARCHAR(255) NOT NULL,
          type            VARCHAR(64) NOT NULL DEFAULT 'image',
          is_active       TINYINT(1) DEFAULT 0,
          timeout_seconds INT DEFAULT 300,
          created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_screensavers_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[http] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms) | device: ${JSON.stringify(req.device || null)} | user: ${JSON.stringify(req.user || null)}`
    );
  });
  next();
});

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

const signDeviceToken = (device) =>
  jwt.sign({ type: "device", id: device.id, owner_id: device.owner_id }, JWT_SECRET, {
    expiresIn: "365d",
  });

function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    let token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token && req.query.token) {
      token = req.query.token;
    }
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
app.get("/api/public/discovery", (req, res) => {
  res.json({
    type: "reviewos-server",
    server: `${req.protocol}://${req.get("host")}`,
  });
});

app.all(
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

function computeTrialInfo(user) {
  if (!user) return { isExpired: false, status: "active", daysLeft: 999, trialEndsAt: null, createdAt: null };
  const role = String(user.role || "").toLowerCase();
  if (role === "admin" || role === "superadmin" || role === "super_admin" || role === "owner") {
    return { isExpired: false, status: "active", daysLeft: 999, trialEndsAt: null, createdAt: user.created_at || null };
  }
  if (user.subscription_status === "active") {
    return { isExpired: false, status: "active", daysLeft: 999, trialEndsAt: user.trial_ends_at || null, createdAt: user.created_at || null };
  }

  const createdAt = user.created_at ? new Date(user.created_at) : new Date();
  const trialEnds = user.trial_ends_at 
    ? new Date(user.trial_ends_at) 
    : new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const now = new Date();
  const diffMs = trialEnds.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isExpired = now > trialEnds || user.subscription_status === "expired";

  return {
    isExpired,
    status: isExpired ? "expired" : "trial",
    daysLeft,
    trialEndsAt: trialEnds.toISOString(),
    createdAt: user.created_at || null,
  };
}

async function requireTrialNotExpired(req, res, next) {
  if (!req.user || req.user.role === "super") return next();
  try {
    const [rows] = await pool.query(
      "SELECT id, role, status, subscription_status, trial_ends_at, created_at FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    if (rows[0]) {
      const trialInfo = computeTrialInfo(rows[0]);
      if (trialInfo.isExpired) {
        return res.status(403).json({
          error: "Trial Expired",
          message: "Your 7-day free trial has expired. Please contact your system administrator to unlock full access.",
          trial_expired: true,
          trial_info: trialInfo,
        });
      }
    }
  } catch (e) {}
  next();
}

app.post(
  "/api/auth/login",
  asyncH(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const [rows] = await pool.query(
      "SELECT id, name, email, password_hash, role, status, local_mode, max_devices FROM users WHERE email = ? LIMIT 1",
      [email.trim().toLowerCase()],
    );
    let u = rows[0];
    let ok = false;
    if (u) {
      ok = await bcrypt.compare(password, u.password_hash);
    }

    if ((!u || !ok) && useSqlite) {
      console.log(`[auth] User not found locally or password mismatch. Attempting authentication against cloud server: ${CLOUD_URL}...`);
      try {
        const cloudLoginRes = await fetch(`${CLOUD_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        
        if (cloudLoginRes.ok) {
          const loginData = await cloudLoginRes.json();
          const remoteUser = loginData.user;
          console.log(`[auth] Cloud authentication successful for user: ${remoteUser.email}. Registering/updating user locally...`);
          // The cloud has already validated this password. Store only a
          // BCrypt hash locally so subsequent logins work without internet.
          const localPasswordHash = await bcrypt.hash(password, 10);
          
          await pool.query(
            "INSERT OR REPLACE INTO users (id, name, email, password_hash, role, status, local_mode, max_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              remoteUser.id,
              remoteUser.name,
              remoteUser.email.trim().toLowerCase(),
              localPasswordHash,
              remoteUser.role,
              remoteUser.status || "active",
              remoteUser.local_mode || "multi",
              remoteUser.max_devices || 1
            ]
          );

          const [newRows] = await pool.query(
            "SELECT id, name, email, password_hash, role, status, local_mode, max_devices FROM users WHERE email = ? LIMIT 1",
            [email.trim().toLowerCase()],
          );
          u = newRows[0];
          if (u) ok = true;
        } else {
          const loginErrText = await cloudLoginRes.text().catch(() => "");
          console.error(`[auth] Cloud fallback authentication failed. Status: ${cloudLoginRes.status}, Body: ${loginErrText}`);
        }
      } catch (cloudErr) {
        console.error("[auth] Cloud fallback authentication error encountered:", cloudErr);
      }
    }

    if (!u || !ok || u.status === "disabled")
      return res.status(401).json({ error: "Invalid credentials" });
      
    // Local server login restrictions: Only local Network sub-admins (role === 'sub', local_mode === 'multi') are permitted to log in.
    if (useSqlite) {
      if (u.role !== "sub" || u.local_mode !== "multi") {
        return res.status(403).json({ error: "Only local network sub-admins are permitted to log in on this local server." });
      }
      localLoginPasswords.set(String(u.id), String(password));
    }

    const user = { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, local_mode: u.local_mode, max_devices: u.max_devices };
    res.json({ token: signToken(user), user });
  }),
);

app.get(
  "/api/me",
  auth(),
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, name, email, role, status, subscription_status, trial_ends_at, local_mode, max_devices, created_at FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    const user = rows[0];
    user.trial_info = computeTrialInfo(user);
    res.json({ user });
  }),
);

app.post(
  "/api/cloud-sync/entitlements",
  auth(),
  asyncH(async (req, res) => {
    if (!useSqlite) {
      return res.status(404).json({ error: "Cloud entitlement sync is available only in the Windows local server." });
    }

    const [rows] = await pool.query(
      "SELECT id, email, role, status, local_mode, max_devices FROM users WHERE id = ? LIMIT 1",
      [req.user.id],
    );
    const localUser = rows[0];
    if (!localUser || localUser.role !== "sub" || localUser.local_mode !== "multi") {
      return res.status(403).json({ error: "Only a local Network account can sync its cloud device allowance." });
    }

    const password = localLoginPasswords.get(String(localUser.id));
    if (!password) {
      return res.status(428).json({
        error: "Please sign out and sign in once, then press Sync from Cloud again.",
      });
    }

    let cloudResponse;
    try {
      cloudResponse = await fetch(`${CLOUD_URL.replace(/\/+$/, "")}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: localUser.email, password }),
      });
    } catch {
      return res.status(503).json({
        error: "Cloud is unreachable. Local ReviewOS data was not changed.",
      });
    }

    if (!cloudResponse.ok) {
      return res.status(cloudResponse.status === 401 ? 401 : 502).json({
        error:
          cloudResponse.status === 401
            ? "The current cloud password is incorrect. Sign out and sign in with the latest password."
            : `Cloud login failed (${cloudResponse.status}). Local data was not changed.`,
      });
    }

    const cloudLogin = await cloudResponse.json();
    const cloudUser = cloudLogin?.user || {};
    const cloudLimit = Number(cloudUser.max_devices);
    if (!Number.isInteger(cloudLimit) || cloudLimit < 1) {
      return res.status(502).json({
        error: "Cloud did not return a valid maximum device allowance. Local data was not changed.",
      });
    }

    const previousMaxDevices = Number(localUser.max_devices) || 1;
    await pool.query("UPDATE users SET max_devices = ? WHERE id = ?", [
      cloudLimit,
      localUser.id,
    ]);

    // Deliberately entitlement-only: local devices, templates, responses,
    // schedules, uploads, profiles, and password hashes remain untouched.
    res.json({
      success: true,
      previous_max_devices: previousMaxDevices,
      max_devices: cloudLimit,
    });
  }),
);

app.get(
  "/api/templates",
  auth(),
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT id, name, description, category, status, questions, display_mode, branding, created_at, updated_at FROM templates WHERE owner_id = ? ORDER BY id DESC",
      [req.user.id]
    );
    res.json({
      templates: rows.map((t) => {
        const b = parseJson(t.branding, null) || {};
        return {
          ...t,
          displayMode: t.display_mode,
          brand_color: b.brandColor || "#0F766E",
          background_image: null,
          branding: b,
          questions: parseJson(t.questions, []),
        };
      }),
    });
  }),
);

app.post(
  "/api/templates",
  auth(),
  requireTrialNotExpired,
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
    const ownerId = req.device ? req.device.owner_id : req.user.id;
    const [rows] = await pool.query(
      "SELECT id, name, description, category, status, questions, display_mode, branding, created_at, updated_at FROM templates WHERE id = ? AND owner_id = ? LIMIT 1",
      [id, ownerId],
    );
    const template = rows[0];
    if (!template) return res.status(404).json({ error: "Template not found" });

    // Load owner profile settings to override branding if show_brand_header is enabled
    const [profileRows] = await pool.query(
      "SELECT organization, avatar_url, show_brand_header, brand_header_placement FROM user_profiles WHERE user_id = ? LIMIT 1",
      [ownerId]
    );
    const profile = profileRows[0] || {};
    let brandingObj = parseJson(template.branding, null) || { enabled: false };
    if (brandingObj.enabled === undefined) {
      brandingObj.enabled = false;
    }
    
    if (profile.show_brand_header) {
      let logoBase64 = null;
      if (profile.avatar_url) {
        try {
          const fs = require("node:fs");
          const filename = profile.avatar_url.replace("/uploads/", "");
          const filePath = path.join(baseDir, "uploads", filename);
          if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filename).replace(".", "");
            logoBase64 = `data:image/${ext};base64,${buffer.toString("base64")}`;
          } else {
            // Fallback if not found on disk
            logoBase64 = profile.avatar_url;
          }
        } catch (err) {
          console.error("Failed to base64-encode logo file for tablet:", err);
          logoBase64 = profile.avatar_url;
        }
      }

      brandingObj = {
        ...brandingObj,
        enabled: true,
        companyName: profile.organization || brandingObj.companyName || "ReviewOS",
        logoUrl: logoBase64 || brandingObj.logoUrl || null,
        show_brand_header: true,
        brand_header_placement: profile.brand_header_placement || "top",
        position: brandingObj.position || "top_right",
        size: brandingObj.size || 100,
        offsetX: brandingObj.offsetX || 16,
        offsetY: brandingObj.offsetY || 16,
      };
    } else {
      brandingObj.show_brand_header = false;
    }

    res.json({
      ...template,
      displayMode: template.display_mode,
      brand_color: brandingObj.brandColor || "#0F766E",
      background_image: null,
      branding: brandingObj,
      questions: parseJson(template.questions, []),
    });
  }),
);

app.put(
  "/api/templates/:id",
  auth(),
  asyncH(async (req, res) => {
    const { name, description, category, status, questions, displayMode, branding } = req.body || {};
    const [result] = await pool.query(
      "UPDATE templates SET name=?, description=?, category=?, status=?, questions=?, display_mode=?, branding=?, updated_at=NOW() WHERE id=? AND owner_id=?",
      [
        name,
        description,
        category,
        status,
        JSON.stringify(questions ?? []),
        displayMode || "multi_page",
        JSON.stringify(branding || null),
        Number(req.params.id),
        req.user.id,
      ],
    );
    if (result.affectedRows === 0) return res.status(403).json({ error: "Access denied" });
    res.json({ ok: true });
  }),
);

app.delete(
  "/api/templates/:id",
  auth(),
  asyncH(async (req, res) => {
    const [result] = await pool.query("DELETE FROM templates WHERE id = ? AND owner_id = ?", [
      Number(req.params.id),
      req.user.id
    ]);
    if (result.affectedRows === 0) return res.status(403).json({ error: "Access denied" });
    res.json({ ok: true });
  }),
);

app.get(
  "/api/devices/me",
  auth(),
  deviceAuth,
  asyncH(async (req, res) => {
    await pool.query("UPDATE devices SET last_sync = NOW(), status = 'online' WHERE id = ?", [
      req.device.id,
    ]);
    const [rows] = await pool.query(
      "SELECT id, owner_id, name, location, status, android_version, last_sync, template_id, created_at, schedules_enabled FROM devices WHERE id = ? LIMIT 1",
      [req.device.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Device not found" });

    const fallback = rows[0].template_id;
    const schedulesEnabled = rows[0].schedules_enabled ?? 1;
    let activeTemplateId = fallback;

    if (schedulesEnabled) {
      // Fetch owner's timezone to translate server time to client time
      const [profileRows] = await pool.query(
        "SELECT timezone FROM user_profiles WHERE user_id = ? LIMIT 1",
        [rows[0].owner_id]
      );
      const tzName = profileRows[0]?.timezone || "IST";
      const tzMap = {
        "IST": "Asia/Kolkata",
        "EST": "America/New_York",
        "CST": "America/Chicago",
        "PST": "America/Los_Angeles",
        "GMT": "Europe/London",
        "UTC": "UTC"
      };
      const targetTz = tzMap[tzName] || tzName || "Asia/Kolkata";

      const formatOpt = { timeZone: targetTz, hour12: false };
      const dateStr = new Intl.DateTimeFormat("en-US", {
        ...formatOpt,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
      const [mm, dd, yyyy] = dateStr.split("/");
      const today = `${yyyy}-${mm}-${dd}`;


      // Build a reliable HH:MM:SS string in the target timezone that exactly
      // matches how times are stored in schedule_instances (e.g. "10:15:00").
      // Intl.DateTimeFormat can return locale-specific strings on some Node versions.
      const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: targetTz }));
      const hh = String(nowInTz.getHours()).padStart(2, "0");
      const min = String(nowInTz.getMinutes()).padStart(2, "0");
      const sec = String(nowInTz.getSeconds()).padStart(2, "0");
      const hhmmss = `${hh}:${min}:${sec}`;

      const [activeRows] = await pool.query(
        `SELECT template_id FROM schedule_instances
         WHERE device_id = ? AND date = ? AND start_time <= ? AND end_time > ?
         LIMIT 1`,
        [req.device.id, today, hhmmss, hhmmss]
      );

      if (activeRows[0]) {
        activeTemplateId = activeRows[0].template_id;
      }
    }

    // Fetch active screensaver for this device owner
    const [ssRows] = await pool.query(
      "SELECT url, type, timeout_seconds FROM screensavers WHERE owner_id = ? AND is_active = 1 LIMIT 1",
      [rows[0].owner_id]
    );

    res.json({
      ...rows[0],
      template_id: activeTemplateId,
      screensaver: ssRows[0] || null
    });
  }),
);

app.delete(
  "/api/devices/me",
  auth(),
  deviceAuth,
  asyncH(async (req, res) => {
    await pool.query("DELETE FROM devices WHERE id = ?", [req.device.id]);
    res.json({ ok: true });
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
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT d.id, d.name, d.location, d.status, d.android_version, d.last_sync,
              d.template_id, d.schedules_enabled,
              TIMESTAMPDIFF(SECOND, d.last_sync, NOW()) AS seconds_since_sync,
              (SELECT COUNT(*) FROM responses r WHERE r.device_id = d.id AND DATE(r.submitted_at) = CURDATE()) AS responses_today
       FROM devices d WHERE d.owner_id = ? ORDER BY d.id DESC`,
       [req.user.id]
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
  requireTrialNotExpired,
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

    // Check max_devices limit
    const [userRows] = await pool.query("SELECT local_mode, max_devices FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    const u = userRows[0];
    if (u) {
      const [countRows] = await pool.query("SELECT COUNT(*) as count FROM devices WHERE owner_id = ?", [req.user.id]);
      const currentCount = countRows[0].count;
      if (currentCount >= u.max_devices) {
        return res.status(403).json({ error: `Device limit reached. Your maximum allowed devices is ${u.max_devices}.` });
      }
    }

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
    const deviceId = Number(req.params.id);
    const tid = req.body?.template_id ?? null;

    if (tid !== null) {
      const [tpl] = await pool.query("SELECT id FROM templates WHERE id = ? AND owner_id = ? LIMIT 1", [tid, req.user.id]);
      if (tpl.length === 0) return res.status(403).json({ error: "Access denied" });
    }

    const [result] = await pool.query("UPDATE devices SET template_id = ? WHERE id = ? AND owner_id = ?", [
      tid,
      deviceId,
      req.user.id,
    ]);
    if (result.affectedRows === 0) return res.status(403).json({ error: "Access denied" });
    res.json({ ok: true });
  }),
);

app.put(
  "/api/devices/:id",
  auth(),
  asyncH(async (req, res) => {
    const deviceId = Number(req.params.id);
    const { name, location, status, schedules_enabled, template_id } = req.body || {};

    const [existing] = await pool.query("SELECT * FROM devices WHERE id = ? AND owner_id = ? LIMIT 1", [deviceId, req.user.id]);
    if (existing.length === 0) return res.status(403).json({ error: "Access denied" });
    const dev = existing[0];

    if (template_id !== undefined && template_id !== null) {
      const [tpl] = await pool.query("SELECT id FROM templates WHERE id = ? AND owner_id = ? LIMIT 1", [template_id, req.user.id]);
      if (tpl.length === 0) return res.status(403).json({ error: "Access denied" });
    }

    const finalName = name !== undefined ? name : dev.name;
    const finalLocation = location !== undefined ? location : dev.location;
    const finalStatus = status !== undefined ? status : dev.status;
    const finalSchedulesEnabled = schedules_enabled !== undefined ? (schedules_enabled ? 1 : 0) : (dev.schedules_enabled ?? 1);
    const finalTemplateId = template_id !== undefined ? template_id : dev.template_id;

    await pool.query(
      `UPDATE devices 
       SET name = ?, location = ?, status = ?, schedules_enabled = ?, template_id = ? 
       WHERE id = ? AND owner_id = ?`,
      [
        finalName,
        finalLocation,
        finalStatus,
        finalSchedulesEnabled,
        finalTemplateId,
        deviceId,
        req.user.id
      ]
    );
    res.json({ ok: true });
  }),
);

app.delete(
  "/api/devices/:id",
  auth(),
  asyncH(async (req, res) => {
    const [result] = await pool.query("DELETE FROM devices WHERE id = ? AND owner_id = ?", [Number(req.params.id), req.user.id]);
    if (result.affectedRows === 0) return res.status(403).json({ error: "Access denied" });
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
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT r.id, r.template_id, t.name AS template, t.questions AS template_questions, r.device_id, d.name AS device,
              r.rating, r.answers, r.submitted_at, r.duration_seconds
       FROM responses r
       LEFT JOIN templates t ON t.id = r.template_id
       LEFT JOIN devices d ON d.id = r.device_id
       WHERE (d.owner_id = ? OR t.owner_id = ?)
       ORDER BY r.submitted_at DESC LIMIT 500`,
      [req.user.id, req.user.id]
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
  "/api/reports/responses",
  auth(),
  asyncH(async (req, res) => {
    const { device_id, from_date, to_date } = req.query;
    let query = `
      SELECT r.id, r.template_id, t.name AS template, t.questions AS template_questions, r.device_id, d.name AS device,
             r.rating, r.answers, r.submitted_at, r.duration_seconds
      FROM responses r
      LEFT JOIN templates t ON t.id = r.template_id
      LEFT JOIN devices d ON d.id = r.device_id
      WHERE (d.owner_id = ? OR t.owner_id = ?)
    `;
    const params = [req.user.id, req.user.id];
    if (device_id && device_id !== "all") {
      query += " AND r.device_id = ?";
      params.push(Number(device_id));
    }
    if (from_date) {
      query += " AND DATE(r.submitted_at) >= ?";
      params.push(from_date);
    }
    if (to_date) {
      query += " AND DATE(r.submitted_at) <= ?";
      params.push(to_date);
    }
    query += " ORDER BY r.submitted_at DESC";
    const [rows] = await pool.query(query, params);
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
      `SELECT u.id, u.name, u.email, u.role, u.status, u.subscription_status, u.trial_ends_at, u.local_mode, u.max_devices, u.created_at,
              (SELECT COUNT(*) FROM devices d WHERE d.owner_id = u.id) AS devices,
              (SELECT COUNT(*) FROM templates t WHERE t.owner_id = u.id) AS templates
       FROM users u ORDER BY u.id DESC`,
    );
    const enriched = rows.map((u) => ({
      ...u,
      trial_info: computeTrialInfo(u),
    }));
    res.json({ admins: enriched });
  }),
);

app.post(
  "/api/admins",
  auth(),
  requireSuper,
  asyncH(async (req, res) => {
    const { name, email, password, role = "sub", local_mode = "none", max_devices = 1 } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (password.length < 8) return res.status(400).json({ error: "password must be >=8 chars" });
    const hash = await bcrypt.hash(password, 10);
    try {
      const trialEndsStr = useSqlite
        ? "datetime('now', '+7 days')"
        : "DATE_ADD(NOW(), INTERVAL 7 DAY)";
      const [r] = await pool.query(
        useSqlite
          ? `INSERT INTO users (name, email, password_hash, role, status, subscription_status, trial_ends_at, local_mode, max_devices) VALUES (?, ?, ?, ?, 'active', 'trial', datetime('now', '+7 days'), ?, ?)`
          : `INSERT INTO users (name, email, password_hash, role, status, subscription_status, trial_ends_at, local_mode, max_devices) VALUES (?, ?, ?, ?, 'active', 'trial', DATE_ADD(NOW(), INTERVAL 7 DAY), ?, ?)`,
        [name || email.split("@")[0], email.trim().toLowerCase(), hash, role, local_mode, Number(max_devices)],
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

app.put(
  "/api/admins/:id/access",
  auth(),
  requireSuper,
  asyncH(async (req, res) => {
    const userId = Number(req.params.id);
    const { status } = req.body || {}; // 'active' (full access) or 'trial' (reset 7-day trial)
    if (!["active", "trial", "expired"].includes(status)) {
      return res.status(400).json({ error: "Invalid subscription status" });
    }

    if (status === "active") {
      await pool.query(
        "UPDATE users SET subscription_status = 'active' WHERE id = ?",
        [userId]
      );
    } else if (status === "trial") {
      await pool.query(
        useSqlite
          ? "UPDATE users SET subscription_status = 'trial', trial_ends_at = datetime('now', '+7 days') WHERE id = ?"
          : "UPDATE users SET subscription_status = 'trial', trial_ends_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE id = ?",
        [userId]
      );
    } else {
      await pool.query(
        "UPDATE users SET subscription_status = 'expired' WHERE id = ?",
        [userId]
      );
    }
    res.json({ ok: true });
  }),
);

app.put(
  "/api/admins/:id",
  auth(),
  requireSuper,
  asyncH(async (req, res) => {
    const userId = Number(req.params.id);
    const { name, email, password, local_mode, max_devices } = req.body || {};
    
    // Check if user exists
    const [exist] = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
    if (!exist.length) return res.status(404).json({ error: "User not found" });
    
    const fields = [];
    const params = [];
    
    if (name !== undefined) {
      fields.push("name = ?");
      params.push(name);
    }
    
    if (email !== undefined) {
      if (!email.includes("@")) return res.status(400).json({ error: "Invalid email format" });
      fields.push("email = ?");
      params.push(email.trim().toLowerCase());
    }
    
    if (password !== undefined && password.trim() !== "") {
      if (password.length < 8) return res.status(400).json({ error: "password must be >=8 chars" });
      const hash = await bcrypt.hash(password, 10);
      fields.push("password_hash = ?");
      params.push(hash);
    }
    
    if (local_mode !== undefined) {
      fields.push("local_mode = ?");
      params.push(local_mode);
    }
    
    if (max_devices !== undefined) {
      fields.push("max_devices = ?");
      params.push(Number(max_devices));
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    
    params.push(userId);
    
    try {
      await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params);
      res.json({ ok: true });
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email already exists" });
      throw e;
    }
  }),
);

// Helper to compute CRC-32 checksums for ZIP headers
function computeCrc32(buf) {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

// Pure JS ZIP generator (Store-only, uncompressed)
function makeZip(files) {
  const localHeaders = [];
  const localDatas = [];
  const centralHeaders = [];
  let currentOffset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf8");
    const dataBuf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    const crc = computeCrc32(dataBuf);
    const size = dataBuf.length;

    // Fixed DOS date/time (12:00:00, 2026-07-12)
    const time = 0x6000;
    const date = 0x5CEF;

    // 1. Local File Header
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(10, 4);
    lfh.writeUInt16LE(0, 6);
    lfh.writeUInt16LE(0, 8); // compression method (0 = store)
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(size, 18);
    lfh.writeUInt32LE(size, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);

    localHeaders.push(Buffer.concat([lfh, nameBuf]));
    localDatas.push(dataBuf);

    // 2. Central Directory File Header
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(10, 6);
    cdh.writeUInt16LE(0, 8);
    cdh.writeUInt16LE(0, 10);
    cdh.writeUInt16LE(time, 12);
    cdh.writeUInt16LE(date, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(size, 20);
    cdh.writeUInt32LE(size, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(currentOffset, 42);

    centralHeaders.push(Buffer.concat([cdh, nameBuf]));
    currentOffset += 30 + nameBuf.length + size;
  }

  const localPart = Buffer.concat(localHeaders.flatMap((h, i) => [h, localDatas[i]]));
  const centralPart = Buffer.concat(centralHeaders);

  // 3. End of Central Directory Record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localPart, centralPart, eocd]);
}

app.get(
  "/api/downloads/local-server-pkg",
  auth(),
  requireSuper,
  asyncH(async (req, res) => {
    try {
      const fs = require("fs");
      const path = require("path");
      const bcrypt = require("bcryptjs");
      const exeName = ["local-server", "exe"].join(".");
      const exePath = path.join(__dirname, exeName);
      if (fs.existsSync(exePath)) {
        const exeBuffer = fs.readFileSync(exePath);
        
        // Dynamically compile backup segment data for target sub admin
        const userId = req.query.userId ? parseInt(req.query.userId, 10) : req.user.id;
        const customEmail = req.query.customEmail || null;
        const customPassword = req.query.customPassword || null;
        const customMaxDevices = req.query.customMaxDevices || null;

        // Fetch target user info
        const [userRows] = await pool.query(
          "SELECT id, name, email, password_hash, role, status, local_mode, max_devices FROM users WHERE id = ? LIMIT 1",
          [userId]
        );
        const targetUser = userRows[0];
        if (!targetUser) {
          return res.status(404).json({ error: "Target sub admin not found" });
        }

        // Apply overrides if passed from the download configuration popup
        if (customEmail) {
          const trimmedEmail = customEmail.trim().toLowerCase();
          targetUser.email = trimmedEmail;
          await pool.query("UPDATE users SET email = ? WHERE id = ?", [trimmedEmail, userId]);
        }

        if (customPassword) {
          const hashed = await bcrypt.hash(customPassword, 10);
          targetUser.password_hash = hashed;
          await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashed, userId]);
        }

        if (customMaxDevices) {
          const limit = parseInt(customMaxDevices, 10);
          if (!isNaN(limit) && limit >= 1) {
            targetUser.max_devices = limit;
            await pool.query("UPDATE users SET max_devices = ? WHERE id = ?", [limit, userId]);
          }
        }

        const [profile] = await pool.query(
          "SELECT organization, timezone, avatar_url, show_brand_header, brand_header_placement FROM user_profiles WHERE user_id = ? LIMIT 1",
          [userId]
        );

        const [templates] = await pool.query(
          "SELECT id, name, description, category, status, questions, display_mode, branding FROM templates WHERE owner_id = ?",
          [userId]
        );

        const [devices] = await pool.query(
          "SELECT id, name, location, status, android_version, template_id, schedules_enabled FROM devices WHERE owner_id = ?",
          [userId]
        );

        const [screensavers] = await pool.query(
          "SELECT id, name, url, type, is_active, timeout_seconds FROM screensavers WHERE owner_id = ?",
          [userId]
        );

        const [schedules] = await pool.query(
          "SELECT id, device_id, template_id, start_time, end_time, start_date FROM schedules WHERE owner_id = ?",
          [userId]
        );

        const scheduleIds = schedules.map(s => s.id);
        let recurrences = [];
        let instances = [];
        if (scheduleIds.length > 0) {
          const [recRows] = await pool.query(
            "SELECT schedule_id, repeat_mode, repeat_interval, days_count FROM schedule_recurrences WHERE schedule_id IN (?)",
            [scheduleIds]
          );
          recurrences = recRows;

          const [instRows] = await pool.query(
            "SELECT schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime FROM schedule_instances WHERE schedule_id IN (?)",
            [scheduleIds]
          );
          instances = instRows;
        }

        const templateIds = templates.map(t => t.id);
        const deviceIds = devices.map(d => d.id);
        let responses = [];
        if (templateIds.length > 0 || deviceIds.length > 0) {
          let respQuery = "SELECT id, template_id, device_id, rating, answers, duration_seconds, submitted_at FROM responses WHERE 1=0";
          const respParams = [];
          if (templateIds.length > 0) {
            respQuery += " OR template_id IN (?)";
            respParams.push(templateIds);
          }
          if (deviceIds.length > 0) {
            respQuery += " OR device_id IN (?)";
            respParams.push(deviceIds);
          }
          const [respRows] = await pool.query(respQuery, respParams);
          responses = respRows;
        }

        const backupPayload = {
          version: 1,
          profile: profile[0] || null,
          user_meta: { local_mode: targetUser.local_mode, max_devices: targetUser.max_devices },
          users: [targetUser], // Hardcode ONLY this specific sub-admin user record
          templates,
          devices,
          screensavers,
          schedules,
          recurrences,
          instances,
          responses
        };

        const readmeContent = `ReviewOS Feedback-Flow Local Server Package
=========================================================

This package contains the standalone local server executable for Windows.

Running instructions:
---------------------
1. Extract the contents of "local-server.zip" into a dedicated folder on your computer.
2. Ensure both "local-server.exe" and "backup.json" are extracted to the same folder.
3. Double-click "local-server.exe". The setup wizard will install the app and automatically configure your local database segment on first start.
4. Navigate to http://localhost:3000/login in your browser to sign in using your local sub-admin account (e.g. your sub-admin email and password).
`;

        const encryptedPayload = encryptBackup(backupPayload);

        const zipBuffer = makeZip([
          { name: exeName, content: exeBuffer },
          { name: "backup.json", content: Buffer.from(encryptedPayload, "utf8") },
          { name: "README.txt", content: readmeContent }
        ]);

        res.status(200);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", "attachment; filename=local-server.zip");
        res.send(zipBuffer);
      } else {
        res.status(200).json({ error: `${exeName} file not found on server root` });
      }
    } catch (err) {
      console.error("[local-server-pkg] zip failed:", err);
      res.status(200).json({
        error: "Failed to compile ZIP package",
        message: err.message,
        stack: err.stack
      });
    }
  }),
);

// ---------------- user profile (org + timezone) ----------------
app.get(
  "/api/profile",
  auth(),
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT organization, timezone, avatar_url, show_brand_header, brand_header_placement FROM user_profiles WHERE user_id = ? LIMIT 1",
      [req.user.id],
    );
    res.json({ profile: rows[0] || { organization: null, timezone: "UTC", avatar_url: null, show_brand_header: 0, brand_header_placement: "top" } });
  }),
);

app.put(
  "/api/profile",
  auth(),
  asyncH(async (req, res) => {
    const { organization = null, timezone = "UTC", avatar_url = null, show_brand_header = 0, brand_header_placement = "top" } = req.body || {};
    await pool.query(
      `INSERT INTO user_profiles (user_id, organization, timezone, avatar_url, show_brand_header, brand_header_placement)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE organization=VALUES(organization), timezone=VALUES(timezone), avatar_url=VALUES(avatar_url), show_brand_header=VALUES(show_brand_header), brand_header_placement=VALUES(brand_header_placement)`,
      [req.user.id, organization, timezone, avatar_url, show_brand_header, brand_header_placement],
    );
    res.json({ ok: true });
  }),
);

// Generic file upload helper
app.post(
  "/api/upload",
  auth(),
  asyncH(async (req, res) => {
    const { filename, base64Data } = req.body || {};
    if (!filename || !base64Data) {
      return res.status(400).json({ error: "filename and base64Data required" });
    }
    const buffer = Buffer.from(base64Data, "base64");
    const uploadsDir = path.join(baseDir, "uploads");
    const fs = require("node:fs");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }
    const uniqueFilename = `${Date.now()}_${filename.replace(/\s+/g, "_")}`;
    const filePath = path.join(uploadsDir, uniqueFilename);
    fs.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/${uniqueFilename}`;
    res.json({ ok: true, url: fileUrl });
  })
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

/*
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
*/

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

  let normStart = startTime;
  if (normStart && (normStart.startsWith("24:00") || normStart.startsWith("24:00:00"))) {
    normStart = "23:59:00";
  }
  let normEnd = endTime;
  if (normEnd && (normEnd.startsWith("24:00") || normEnd.startsWith("24:00:00"))) {
    normEnd = "23:59:00";
  }
  
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
    const startDatetimeStr = `${dateStr} ${normStart}`;
    const endDatetimeStr = `${dateStr} ${normEnd}`;

    instances.push({
      schedule_id: scheduleId,
      device_id: deviceId,
      template_id: templateId,
      date: dateStr,
      start_time: normStart,
      end_time: normEnd,
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
    if (deviceId) {
      const [dev] = await pool.query("SELECT id FROM devices WHERE id = ? AND owner_id = ? LIMIT 1", [deviceId, req.user.id]);
      if (dev.length === 0) return res.status(403).json({ error: "Access denied" });
    }
    const where = deviceId ? "WHERE s.device_id = ?" : "WHERE s.owner_id = ?";
    const params = deviceId ? [deviceId] : [req.user.id];
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
    const [dev] = await pool.query("SELECT id FROM devices WHERE id = ? AND owner_id = ? LIMIT 1", [deviceId, req.user.id]);
    if (dev.length === 0) return res.status(403).json({ error: "Access denied" });
    
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

    // Check device ownership
    const [dev] = await pool.query("SELECT id FROM devices WHERE id = ? AND owner_id = ? LIMIT 1", [Number(device_id), req.user.id]);
    if (dev.length === 0) return res.status(403).json({ error: "Access denied" });

    // Check template ownership
    const [tpl] = await pool.query("SELECT id FROM templates WHERE id = ? AND owner_id = ? LIMIT 1", [Number(template_id), req.user.id]);
    if (tpl.length === 0) return res.status(403).json({ error: "Access denied" });

    let formattedStartTime = start_time.length === 5 ? `${start_time}:00` : start_time;
    let formattedEndTime = end_time.length === 5 ? `${end_time}:00` : end_time;

    if (formattedStartTime.startsWith("24:00")) formattedStartTime = "23:59:00";
    if (formattedEndTime.startsWith("24:00")) formattedEndTime = "23:59:00";

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

      const [curr] = await conn.query("SELECT * FROM schedules WHERE id = ? AND owner_id = ? LIMIT 1", [scheduleId, req.user.id]);
      if (curr.length === 0) {
        await conn.rollback();
        return res.status(403).json({ error: "Access denied" });
      }
      const s = curr[0];

      if (template_id !== undefined) {
        const [tpl] = await conn.query("SELECT id FROM templates WHERE id = ? AND owner_id = ? LIMIT 1", [Number(template_id), req.user.id]);
        if (tpl.length === 0) {
          await conn.rollback();
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const deviceId = s.device_id;
      const tid = template_id !== undefined ? Number(template_id) : s.template_id;
      const st = start_time !== undefined ? start_time : s.start_time;
      const et = end_time !== undefined ? end_time : s.end_time;
      const sd = start_date !== undefined ? start_date : s.start_date;

      let formattedStartTime = st.length === 5 ? `${st}:00` : st;
      let formattedEndTime = et.length === 5 ? `${et}:00` : et;

      if (formattedStartTime.startsWith("24:00")) formattedStartTime = "23:59:00";
      if (formattedEndTime.startsWith("24:00")) formattedEndTime = "23:59:00";

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
         WHERE id = ? AND owner_id = ?`,
        [tid, formattedStartTime, formattedEndTime, sd, scheduleId, req.user.id]
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

    let formattedStartTime = start_time.length === 5 ? `${start_time}:00` : start_time;
    let formattedEndTime = end_time.length === 5 ? `${end_time}:00` : end_time;

    if (formattedStartTime.startsWith("24:00")) formattedStartTime = "23:59:00";
    if (formattedEndTime.startsWith("24:00")) formattedEndTime = "23:59:00";

    if (formattedStartTime >= formattedEndTime) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [curr] = await conn.query("SELECT * FROM schedules WHERE id = ? AND owner_id = ? LIMIT 1", [schedule_id, req.user.id]);
      if (curr.length === 0) {
        await conn.rollback();
        return res.status(403).json({ error: "Access denied" });
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

    const [curr] = await pool.query("SELECT id FROM schedules WHERE id = ? AND owner_id = ? LIMIT 1", [id, req.user.id]);
    if (curr.length === 0) return res.status(403).json({ error: "Access denied" });

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

// POST /api/schedules/clear-day
app.post(
  "/api/schedules/clear-day",
  auth(),
  asyncH(async (req, res) => {
    const { device_id, date } = req.body || {};
    if (!device_id || !date) {
      return res.status(400).json({ error: "device_id and date required" });
    }

    const [dev] = await pool.query("SELECT id FROM devices WHERE id = ? AND owner_id = ? LIMIT 1", [Number(device_id), req.user.id]);
    if (dev.length === 0) return res.status(403).json({ error: "Access denied" });

    // Find all schedule instances for this device on this date
    const [instances] = await pool.query(
      `SELECT DISTINCT r.schedule_id 
       FROM schedule_instances r
       JOIN schedules s ON s.id = r.schedule_id
       WHERE s.device_id = ? AND r.date = ?`,
      [Number(device_id), date]
    );

    for (const inst of instances) {
      await pool.query(
        "DELETE FROM schedule_instances WHERE schedule_id = ? AND date = ?", 
        [inst.schedule_id, date]
      );
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

      const [curr] = await conn.query("SELECT * FROM schedules WHERE id = ? AND owner_id = ? LIMIT 1", [schedule_id, req.user.id]);
      if (curr.length === 0) {
        await conn.rollback();
        return res.status(403).json({ error: "Access denied" });
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
        await conn.query("UPDATE schedules SET start_time = ?, end_time = ? WHERE id = ? AND owner_id = ?", [st, et, schedule_id, req.user.id]);
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
           WHERE s.device_id = ? AND i.id IS NULL AND s.owner_id = ?`,
          [s.device_id, req.user.id]
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

    const [dev] = await pool.query("SELECT id FROM devices WHERE id = ? AND owner_id = ? LIMIT 1", [Number(device_id), req.user.id]);
    if (dev.length === 0) return res.status(403).json({ error: "Access denied" });

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

// POST /api/schedules/copy-device
app.post(
  "/api/schedules/copy-device",
  auth(),
  asyncH(async (req, res) => {
    const { target_device_id, source_device_id, overwrite = false } = req.body || {};
    if (!target_device_id || !source_device_id) {
      return res.status(400).json({ error: "target_device_id and source_device_id required" });
    }

    // 1. Scope / Security checks: Ensure both devices belong to the user
    const [targetDevices] = await pool.query(
      'SELECT id FROM devices WHERE id = ? AND owner_id = ? LIMIT 1',
      [Number(target_device_id), req.user.id]
    );
    const [sourceDevices] = await pool.query(
      'SELECT id FROM devices WHERE id = ? AND owner_id = ? LIMIT 1',
      [Number(source_device_id), req.user.id]
    );

    if (targetDevices.length === 0 || sourceDevices.length === 0) {
      return res.status(404).json({ error: "One or both devices not found or access denied" });
    }

    // Force Indian timezone
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"

    // 2. Overwrite check: If overwrite is false, check if target has future instances
    if (!overwrite) {
      const [existing] = await pool.query(
        `SELECT id FROM schedule_instances 
         WHERE device_id = ? AND date >= ? 
         LIMIT 1`,
        [Number(target_device_id), today]
      );
      if (existing.length > 0) {
        return res.json({ ok: false, has_existing: true });
      }
    }

    // 3. Perform copy in a database transaction
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Delete only future schedule instances of target device
      await conn.query(
        `DELETE FROM schedule_instances WHERE device_id = ? AND date >= ?`,
        [Number(target_device_id), today]
      );

      // Clean up target device parent schedules that no longer have any instances (completely in future)
      await conn.query(
        `DELETE FROM schedules 
         WHERE device_id = ? 
           AND id NOT IN (SELECT DISTINCT schedule_id FROM schedule_instances WHERE device_id = ?)`,
        [Number(target_device_id), Number(target_device_id)]
      );

      // Fetch all schedules and recurrences of source device
      const [srcSchedules] = await conn.query(
        `SELECT s.id, s.template_id, s.start_time, s.end_time, DATE_FORMAT(s.start_date,'%Y-%m-%d') as start_date, 
                r.repeat_mode, r.repeat_interval, r.days_count
         FROM schedules s
         LEFT JOIN schedule_recurrences r ON r.schedule_id = s.id
         WHERE s.device_id = ? AND s.owner_id = ?`,
        [Number(source_device_id), req.user.id]
      );

      let createdSchedules = 0;
      for (const row of srcSchedules) {
        // Generate instances for this source schedule
        const allInstances = generateInstances(
          row.id,
          Number(target_device_id),
          row.template_id,
          row.start_time,
          row.end_time,
          row.start_date,
          row.repeat_mode || 'none',
          row.repeat_interval || 1,
          row.days_count || 1
        );

        // Keep only future instances
        const futureInstances = allInstances.filter(inst => inst.date >= today);

        if (futureInstances.length > 0) {
          // Create parent schedule for target
          const [scheduleRes] = await conn.query(
            `INSERT INTO schedules (device_id, template_id, owner_id, start_time, end_time, start_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [Number(target_device_id), row.template_id, req.user.id, row.start_time, row.end_time, row.start_date]
          );
          const newScheduleId = scheduleRes.insertId;

          // Insert recurrence
          await conn.query(
            `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
             VALUES (?, ?, ?, ?)`,
            [newScheduleId, row.repeat_mode || 'none', row.repeat_interval || 1, row.days_count || 1]
          );

          // Update instances with new schedule ID and convert to nested array for bulk insert
          const instanceValues = futureInstances.map(inst => [
            newScheduleId,
            Number(target_device_id),
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

          createdSchedules++;
        }
      }

      await conn.commit();
      res.json({ ok: true, created: createdSchedules });
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
    await pool.query("UPDATE devices SET last_sync = NOW(), status = 'online' WHERE id = ?", [
      req.device.id,
    ]);
    const [drows] = await pool.query(
      "SELECT id, template_id, schedules_enabled FROM devices WHERE id = ? LIMIT 1",
      [req.device.id],
    );
    if (!drows[0]) return res.status(404).json({ error: "Device not found" });
    const fallback = drows[0].template_id;
    const schedulesEnabled = drows[0].schedules_enabled ?? 1;

    if (!schedulesEnabled) {
      return res.json({
        template_id: fallback,
        source: "default"
      });
    }

    // Fetch owner's timezone to translate server time to client time
    const [profileRows] = await pool.query(
      "SELECT timezone FROM user_profiles WHERE user_id = ? LIMIT 1",
      [req.device.owner_id]
    );
    const tzName = profileRows[0]?.timezone || "IST";
    const tzMap = {
      "IST": "Asia/Kolkata",
      "EST": "America/New_York",
      "CST": "America/Chicago",
      "PST": "America/Los_Angeles",
      "GMT": "Europe/London",
      "UTC": "UTC"
    };
    const targetTz = tzMap[tzName] || tzName || "Asia/Kolkata";

    const formatOpt = { timeZone: targetTz, hour12: false };
    const dateStr = new Intl.DateTimeFormat("en-US", {
      ...formatOpt,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
    const [mm, dd, yyyy] = dateStr.split("/");
    const today = `${yyyy}-${mm}-${dd}`;

    const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: targetTz }));
    const hh = String(nowInTz.getHours()).padStart(2, "0");
    const min = String(nowInTz.getMinutes()).padStart(2, "0");
    const sec = String(nowInTz.getSeconds()).padStart(2, "0");
    const hhmmss = `${hh}:${min}:${sec}`;

    const [activeRows] = await pool.query(
      `SELECT template_id FROM schedule_instances
       WHERE device_id = ? AND date = ? AND start_time <= ? AND end_time > ?
       LIMIT 1`,
      [req.device.id, today, hhmmss, hhmmss]
    );

    const active = activeRows[0];

    // Fetch active screensaver for this device owner
    const [ssRows] = await pool.query(
      "SELECT url, type, timeout_seconds FROM screensavers WHERE owner_id = ? AND is_active = 1 LIMIT 1",
      [req.device.owner_id]
    );

    res.json({
      template_id: active ? active.template_id : fallback,
      source: active ? "schedule" : "default",
      screensaver: ssRows[0] || null
    });
  }),
);

app.get("/api/screensavers/debug", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM screensavers");
    res.json({ count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/templates/debug", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM templates");
    res.json({ count: rows.length, rows: rows.map(r => ({ ...r, questions: parseJson(r.questions, []) })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/devices/debug", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, location, status, template_id, schedules_enabled, last_sync FROM devices");
    res.json({ count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/screensavers
app.get(
  "/api/screensavers",
  auth(),
  asyncH(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT * FROM screensavers WHERE owner_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json({ screensavers: rows });
  })
);

// POST /api/screensavers/upload
app.post(
  "/api/screensavers/upload",
  auth(),
  asyncH(async (req, res) => {
    const { name, filename, base64Data, type = "image" } = req.body || {};
    if (!name || !filename || !base64Data) {
      return res.status(400).json({ error: "name, filename, and base64Data required" });
    }

    // Parse base64 and write to uploads/
    const fs = require("node:fs");
    const uploadsDir = path.join(baseDir, "uploads");
    const uniqueFilename = `${Date.now()}_${filename.replace(/\s+/g, "_")}`;
    const filePath = path.join(uploadsDir, uniqueFilename);
    const fileUrl = `/uploads/${uniqueFilename}`;

    try {
      const buffer = Buffer.from(base64Data, "base64");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(filePath, buffer);
    } catch (fsErr) {
      console.error("[upload error] Failed to write file:", fsErr);
      return res.status(500).json({ error: `File system write error: ${fsErr.message}` });
    }

    let result;
    try {
      const [dbResult] = await pool.query(
        "INSERT INTO screensavers (owner_id, name, url, type, is_active, timeout_seconds) VALUES (?, ?, ?, ?, 0, 300)",
        [req.user.id, name, fileUrl, type]
      );
      result = dbResult;
    } catch (dbErr) {
      console.error("[upload error] Database query failed:", dbErr);
      return res.status(500).json({ error: `Database error: ${dbErr.message}` });
    }

    res.json({
      ok: true,
      screensaver: {
        id: result.insertId,
        name,
        url: fileUrl,
        type,
        is_active: 0,
        timeout_seconds: 300
      }
    });
  })
);

// POST /api/screensavers/activate
app.post(
  "/api/screensavers/activate",
  auth(),
  asyncH(async (req, res) => {
    const { id, timeout_seconds } = req.body || {};
    if (!id) return res.status(400).json({ error: "id required" });

    // Set all screensavers for this user as inactive
    await pool.query("UPDATE screensavers SET is_active = 0 WHERE owner_id = ?", [req.user.id]);

    // Set selected screensaver as active and update timeout
    await pool.query(
      "UPDATE screensavers SET is_active = 1, timeout_seconds = ? WHERE id = ? AND owner_id = ?",
      [Number(timeout_seconds) || 300, Number(id), req.user.id]
    );

    res.json({ ok: true });
  })
);

// POST /api/screensavers/deactivate
app.post(
  "/api/screensavers/deactivate",
  auth(),
  asyncH(async (req, res) => {
    await pool.query("UPDATE screensavers SET is_active = 0 WHERE owner_id = ?", [req.user.id]);
    res.json({ ok: true });
  })
);

// DELETE /api/screensavers/:id
app.delete(
  "/api/screensavers/:id",
  auth(),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);

    const [rows] = await pool.query("SELECT url FROM screensavers WHERE id = ? AND owner_id = ?", [id, req.user.id]);
    if (rows.length > 0) {
      const url = rows[0].url;
      const filename = url.replace("/uploads/", "");
      const filePath = path.join(baseDir, "uploads", filename);
      const fs = require("node:fs");
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn("Could not delete screensaver file: ", e);
        }
      }
    }

    await pool.query("DELETE FROM screensavers WHERE id = ? AND owner_id = ?", [id, req.user.id]);
    res.json({ ok: true });
  })
);

// GET /api/backup (Download full user database segment)
app.get(
  "/api/backup",
  auth(),
  asyncH(async (req, res) => {
    const userId = req.user.id;

    const [profile] = await pool.query(
      "SELECT organization, timezone, avatar_url, show_brand_header, brand_header_placement FROM user_profiles WHERE user_id = ? LIMIT 1",
      [userId]
    );

    const [templates] = await pool.query(
      "SELECT id, name, description, category, status, questions, display_mode, branding FROM templates WHERE owner_id = ?",
      [userId]
    );

    const [devices] = await pool.query(
      "SELECT id, name, location, status, android_version, template_id, schedules_enabled FROM devices WHERE owner_id = ?",
      [userId]
    );

    const [screensavers] = await pool.query(
      "SELECT id, name, url, type, is_active, timeout_seconds FROM screensavers WHERE owner_id = ?",
      [userId]
    );

    const [schedules] = await pool.query(
      "SELECT id, device_id, template_id, start_time, end_time, start_date FROM schedules WHERE owner_id = ?",
      [userId]
    );

    const scheduleIds = schedules.map(s => s.id);
    let recurrences = [];
    let instances = [];
    if (scheduleIds.length > 0) {
      const [recRows] = await pool.query(
        "SELECT schedule_id, repeat_mode, repeat_interval, days_count FROM schedule_recurrences WHERE schedule_id IN (?)",
        [scheduleIds]
      );
      recurrences = recRows;

      const [instRows] = await pool.query(
        "SELECT schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime FROM schedule_instances WHERE schedule_id IN (?)",
        [scheduleIds]
      );
      instances = instRows;
    }

    const templateIds = templates.map(t => t.id);
    const deviceIds = devices.map(d => d.id);
    let responses = [];
    if (templateIds.length > 0 || deviceIds.length > 0) {
      let respQuery = "SELECT id, template_id, device_id, rating, answers, duration_seconds, submitted_at FROM responses WHERE 1=0";
      const respParams = [];
      if (templateIds.length > 0) {
        respQuery += " OR template_id IN (?)";
        respParams.push(templateIds);
      }
      if (deviceIds.length > 0) {
        respQuery += " OR device_id IN (?)";
        respParams.push(deviceIds);
      }
      const [respRows] = await pool.query(respQuery, respParams);
      responses = respRows;
    }

    const [userMetaRows] = await pool.query(
      "SELECT local_mode, max_devices FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const userMeta = userMetaRows[0] || { local_mode: "none", max_devices: 1 };

    const [allUsers] = await pool.query(
      "SELECT id, name, email, password_hash, role, status, local_mode, max_devices FROM users"
    );

    res.json({
      version: 1,
      profile: profile[0] || null,
      user_meta: userMeta,
      users: allUsers,
      templates,
      devices,
      screensavers,
      schedules,
      recurrences,
      instances,
      responses
    });
  })
);

// POST /api/restore (Upload and reconstruct user database segment mapping IDs dynamically)
app.post(
  "/api/restore",
  auth(),
  asyncH(async (req, res) => {
    const userId = req.user.id;
    const { profile, templates = [], devices = [], screensavers = [], schedules = [], recurrences = [], instances = [], responses = [] } = req.body || {};

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Restore Profile
      if (profile) {
        await conn.query(
          `INSERT INTO user_profiles (user_id, organization, timezone, avatar_url, show_brand_header, brand_header_placement)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE organization=VALUES(organization), timezone=VALUES(timezone), avatar_url=VALUES(avatar_url), show_brand_header=VALUES(show_brand_header), brand_header_placement=VALUES(brand_header_placement)`,
          [userId, profile.organization, profile.timezone || "IST", profile.avatar_url, profile.show_brand_header || 0, profile.brand_header_placement || "top"]
        );
      }

      // 2. Restore Templates & map IDs
      const templateIdMap = {}; // oldTemplateId -> newTemplateId
      for (const t of templates) {
        const [r] = await conn.query(
          "INSERT INTO templates (owner_id, name, description, category, status, questions, display_mode, branding) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [userId, t.name, t.description || "", t.category || "General", t.status || "draft", JSON.stringify(parseJson(t.questions, [])), t.display_mode || "multi_page", JSON.stringify(parseJson(t.branding, null))]
        );
        templateIdMap[t.id] = r.insertId;
      }

      // 3. Restore Devices & map IDs
      const deviceIdMap = {}; // oldDeviceId -> newDeviceId
      for (const d of devices) {
        const mappedTemplateId = d.template_id ? (templateIdMap[d.template_id] || null) : null;
        const [r] = await conn.query(
          "INSERT INTO devices (owner_id, name, location, status, android_version, template_id, schedules_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [userId, d.name, d.location || null, d.status || "offline", d.android_version || "Android 14", mappedTemplateId, d.schedules_enabled !== undefined ? d.schedules_enabled : 1]
        );
        deviceIdMap[d.id] = r.insertId;
      }

      // 4. Restore Screensavers
      for (const s of screensavers) {
        await conn.query(
          "INSERT INTO screensavers (owner_id, name, url, type, is_active, timeout_seconds) VALUES (?, ?, ?, ?, ?, ?)",
          [userId, s.name, s.url, s.type || "image", s.is_active || 0, s.timeout_seconds || 300]
        );
      }

      // 5. Restore Schedules & Recurrences & map IDs
      const scheduleIdMap = {}; // oldScheduleId -> newScheduleId
      for (const s of schedules) {
        const newDevId = deviceIdMap[s.device_id];
        const newTplId = templateIdMap[s.template_id];
        if (!newDevId || !newTplId) continue;

        const [r] = await conn.query(
          "INSERT INTO schedules (device_id, template_id, owner_id, start_time, end_time, start_date) VALUES (?, ?, ?, ?, ?, ?)",
          [newDevId, newTplId, userId, s.start_time, s.end_time, s.start_date]
        );
        scheduleIdMap[s.id] = r.insertId;
      }

      // 6. Restore Recurrence config
      for (const rec of recurrences) {
        const newSchId = scheduleIdMap[rec.schedule_id];
        if (!newSchId) continue;
        await conn.query(
          "INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count) VALUES (?, ?, ?, ?)",
          [newSchId, rec.repeat_mode || "none", rec.repeat_interval || 1, rec.days_count || 1]
        );
      }

      // 7. Restore Schedule Instances
      for (const inst of instances) {
        const newSchId = scheduleIdMap[inst.schedule_id];
        const newDevId = deviceIdMap[inst.device_id];
        const newTplId = templateIdMap[inst.template_id];
        if (!newSchId || !newDevId || !newTplId) continue;

        await conn.query(
          `INSERT INTO schedule_instances (schedule_id, device_id, template_id, date, start_time, end_time, start_datetime, end_datetime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newSchId, newDevId, newTplId, inst.date, inst.start_time, inst.end_time, inst.start_datetime, inst.end_datetime]
        );
      }

      // 8. Restore Responses
      for (const resp of responses) {
        const newTplId = templateIdMap[resp.template_id];
        const newDevId = resp.device_id ? (deviceIdMap[resp.device_id] || null) : null;
        if (!newTplId) continue;

        await conn.query(
          "INSERT INTO responses (template_id, device_id, rating, answers, duration_seconds, submitted_at) VALUES (?, ?, ?, ?, ?, ?)",
          [newTplId, newDevId, resp.rating, JSON.stringify(parseJson(resp.answers, {})), resp.duration_seconds || 0, resp.submitted_at]
        );
      }

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

app.use("/api", (err, _req, res, _next) => {
  console.error("[api error]", err);
  res.status(500).json({ error: err.message || "Server error" });
});

const distDir = path.join(__dirname, "dist");
app.use("/uploads", express.static(path.join(baseDir, "uploads")));
app.use(express.static(distDir, { maxAge: "1h", index: false }));
app.get(/^(?!\/api).*/, (req, res) => {
  if (req.path.startsWith("/assets/") || /\.(js|css|png|jpg|jpeg|gif|svg|ico|wasm|map)$/i.test(req.path)) {
    return res.status(404).send("Asset not found");
  }
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
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

  // Automatically open default browser if running as a local SQLite server
  if (useSqlite) {
    try {
      const { exec } = require("child_process");
      const url = `http://localhost:${PORT}/login`;
      
      // Auto-create desktop shortcut on Windows for first-time launch
      if (process.platform === "win32") {
        try {
          const fs = require("fs");
          const path = require("path");
          const desktopPath = path.join(process.env.USERPROFILE || "", "Desktop", "ReviewOS Local Server.lnk");
          if (!fs.existsSync(desktopPath)) {
            const exePath = process.execPath;
            const createShortcutScript = `
              $WshShell = New-Object -ComObject WScript.Shell;
              $Shortcut = $WshShell.CreateShortcut('${desktopPath.replace(/'/g, "''")}');
              $Shortcut.TargetPath = '${exePath.replace(/'/g, "''")}';
              $Shortcut.Description = 'ReviewOS Local Server';
              $Shortcut.WorkingDirectory = '${path.dirname(exePath).replace(/'/g, "''")}';
              $Shortcut.Save();
            `;
            exec(`powershell -Command "${createShortcutScript.replace(/\n/g, ' ')}"`, (err) => {
              if (err) console.error("[local] Failed to create desktop shortcut:", err.message);
              else console.log("[local] Successfully created desktop shortcut on Desktop!");
            });
          }
        } catch (shErr) {
          console.error("[local] Shortcut creation error:", shErr.message);
        }
      }

      if (process.platform === "win32") {
        exec(`start ${url}`);
      } else if (process.platform === "darwin") {
        exec(`open ${url}`);
      } else {
        exec(`xdg-open ${url}`);
      }
      console.log(`[local] Automatically opening default browser to ${url}`);
    } catch (e) {
      // ignore browser launch failure
    }
  }

  // Broadcast UDP server presence on local subnet for tablet auto-discovery
  try {
    const dgram = require("dgram");
    const os = require("os");
    const server = dgram.createSocket("udp4");
    let discoveryLogged = false;
    server.bind(() => {
      server.setBroadcast(true);
      setInterval(() => {
        try {
          const interfaces = os.networkInterfaces();
          const ips = [];
          for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
              if (net.family === "IPv4" && !net.internal) {
                ips.push(net.address);
              }
            }
          }
          if (!discoveryLogged && ips.length > 0) {
            console.log(`[discovery] Broadcasting local server presence on: ${ips.map(ip => `http://${ip}:${PORT}`).join(", ")}`);
            discoveryLogged = true;
          }
          for (const ip of ips) {
            const payload = JSON.stringify({
              server: `http://${ip}:${PORT}`,
              type: "reviewos-server"
            });
            const buffer = Buffer.from(payload, "utf8");
            server.send(buffer, 0, buffer.length, 9999, "255.255.255.255");

            // Also send to the interface's directed broadcast address. Many
            // routers and Android devices drop the global broadcast above.
            for (const name of Object.keys(interfaces)) {
              for (const net of interfaces[name]) {
                if (net.family !== "IPv4" || net.internal || net.address !== ip || !net.netmask) continue;
                const address = ip.split(".").map(Number);
                const mask = net.netmask.split(".").map(Number);
                const broadcast = address.map((part, index) => (part & mask[index]) | (~mask[index] & 255)).join(".");
                server.send(buffer, 0, buffer.length, 9999, broadcast);
              }
            }
          }
        } catch (e) {
          // ignore loop errors
        }
      }, 4000);
    });
  } catch (err) {
    console.error("[discovery] failed to init UDP broadcast:", err.message);
  }
});

module.exports = app;
