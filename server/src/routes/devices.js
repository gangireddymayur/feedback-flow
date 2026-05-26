const { Router } = require("express");
const { z } = require("zod");
const { query } = require("../db.js");
const { requireAuth } = require("../middleware/auth.js");
const { asyncHandler } = require("../middleware/error.js");

const devicesRouter = Router();

devicesRouter.get("/", requireAuth(), asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT id, name, location, status, android_version, last_sync, template_id, responses_today
     FROM devices WHERE owner_id = ? ORDER BY name`,
    [req.user.sub],
  );
  res.json({ devices: rows });
}));

const pairSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  name: z.string().min(1).max(120),
  location: z.string().max(200).default(""),
});

devicesRouter.post("/pair", requireAuth(), asyncHandler(async (req, res) => {
  const body = pairSchema.parse(req.body);
  const result = await query(
    `INSERT INTO devices (owner_id, name, location, status, pairing_code)
     VALUES (?, ?, ?, 'offline', ?)`,
    [req.user.sub, body.name, body.location, body.code],
  );
  res.status(201).json({ id: result.insertId });
}));

devicesRouter.post("/:id/heartbeat", asyncHandler(async (req, res) => {
  // Called by the Android device itself (token-auth recommended in production)
  await query(
    `UPDATE devices SET status='online', last_sync=NOW() WHERE id=?`,
    [req.params.id],
  );
  res.json({ ok: true });
}));

devicesRouter.delete("/:id", requireAuth(), asyncHandler(async (req, res) => {
  await query("DELETE FROM devices WHERE id=? AND owner_id=?", [req.params.id, req.user.sub]);
  res.json({ ok: true });
}));

module.exports = { devicesRouter };
