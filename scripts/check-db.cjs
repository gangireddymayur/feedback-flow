require("dotenv/config");

const mysql = require("mysql2/promise");

const { DB_HOST = "localhost", DB_PORT = "3306", DB_USER, DB_PASSWORD, DB_NAME } = process.env;

console.log("[db-check] config", {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  database: DB_NAME,
  passwordSet: Boolean(DB_PASSWORD),
  passwordLength: DB_PASSWORD ? DB_PASSWORD.length : 0,
});

(async () => {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  const [rows] = await connection.query("SELECT 1 AS ok");
  console.log("[db-check] success", rows);
  await connection.end();
})().catch((err) => {
  console.error("[db-check] failed", {
    code: err.code,
    errno: err.errno,
    sqlState: err.sqlState,
    message: err.message,
  });
  process.exit(1);
});
