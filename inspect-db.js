require("dotenv").config();
const mysql = require("mysql2/promise");

const { DB_HOST = "localhost", DB_PORT = "3306", DB_USER, DB_PASSWORD, DB_NAME } = process.env;

(async () => {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    const [templates] = await connection.query("SELECT id, name, questions FROM templates LIMIT 5");
    console.log("TEMPLATES:");
    for (const t of templates) {
      console.log(`- Template #${t.id} (${t.name}):`);
      console.log(JSON.stringify(JSON.parse(t.questions || "[]"), null, 2));
    }

    const [responses] = await connection.query(
      "SELECT id, template_id, rating, answers FROM responses ORDER BY id DESC LIMIT 5",
    );
    console.log("\nRESPONSES:");
    for (const r of responses) {
      console.log(`- Response #${r.id} (template_id: ${r.template_id}, rating: ${r.rating}):`);
      console.log("Answers:", JSON.stringify(JSON.parse(r.answers || "{}"), null, 2));
    }
  } catch (err) {
    console.error("Error inspecting DB:", err);
  } finally {
    await connection.end();
  }
})();
