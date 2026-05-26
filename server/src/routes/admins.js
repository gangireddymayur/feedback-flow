import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

export const adminsRouter = Router();

adminsRouter.get("/", requireAuth(["super"]), asyncHandler(async (_req, res) => {
  const rows = await query(
    `SELECT id, name, email, role, status, created_at,
            (SELECT COUNT(*) FROM devices d   WHERE d.owner_id = a.id) AS devices,
            (SELECT COUNT(*) FROM templates t WHERE t.owner_id = a.id) AS templates
       FROM admins a
       WHERE role = 'sub'
       ORDER BY created_at DESC`,
  );
  res.json({ admins: rows });
}));

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["super", "sub"]).default("sub"),
});

adminsRouter.post("/", requireAuth(["super"]), asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const hash = await bcrypt.hash(body.password, 10);
  const result = await query(
    `INSERT INTO admins (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')`,
    [body.name, body.email, hash, body.role],
  );
  res.status(201).json({ id: result.insertId });
}));

adminsRouter.patch("/:id/status", requireAuth(["super"]), asyncHandler(async (req, res) => {
  const status = req.body?.status === "active" ? "active" : "disabled";
  await query(`UPDATE admins SET status = ? WHERE id = ?`, [status, req.params.id]);
  res.json({ ok: true });
}));
