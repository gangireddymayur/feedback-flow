import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { pool, query } from "../src/db.js";

const sql = fs.readFileSync(path.join(process.cwd(), "scripts/schema.sql"), "utf8");

async function main() {
  // Run each statement separately
  const statements = sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  console.log("✓ Schema applied");

  const existing = await query("SELECT id FROM admins WHERE email = ?", ["admin@reviewos.app"]);
  if (existing.length === 0) {
    const hash = await bcrypt.hash("changeme123", 10);
    await query(
      "INSERT INTO admins (name, email, password_hash, role) VALUES (?, ?, ?, 'super')",
      ["Super Admin", "admin@reviewos.app", hash],
    );
    console.log("✓ Seeded super admin: admin@reviewos.app / changeme123");
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
