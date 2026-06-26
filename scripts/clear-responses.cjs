/**
 * clear-responses.cjs
 * Safely deletes all submitted responses from the database.
 * Run with: node scripts/clear-responses.cjs
 * 
 * SAFE: Does NOT delete templates, devices, or admin accounts.
 * Only clears the responses table so you can test fresh data.
 */
require("dotenv/config");
const mysql = require("mysql2/promise");

const { DB_HOST = "localhost", DB_PORT = "3306", DB_USER, DB_PASSWORD, DB_NAME } = process.env;

(async () => {
  console.log("[clear-responses] Connecting to DB:", { host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USER });

  if (!DB_USER || !DB_PASSWORD || !DB_NAME) {
    console.error("[clear-responses] ERROR: DB environment variables not set. Create a .env file first.");
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    // Count first so we know what we're deleting
    const [[{ count }]] = await connection.query("SELECT COUNT(*) AS count FROM responses");
    console.log(`[clear-responses] Found ${count} responses to delete.`);

    if (count === 0) {
      console.log("[clear-responses] Nothing to delete. Exiting.");
      return;
    }

    // Delete all responses
    await connection.query("DELETE FROM responses");
    console.log(`[clear-responses] ✅ Deleted ${count} responses successfully.`);
    console.log("[clear-responses] Templates, devices, and admin accounts are untouched.");
    console.log("[clear-responses] You can now test fresh responses from the tablet app!");
  } catch (err) {
    console.error("[clear-responses] ERROR:", err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
})();
