import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

export const responsesRouter = Router();

responsesRouter.get("/", requireAuth(), asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT r.id, r.template_id, t.name AS template, r.device_id, d.name AS device,
            r.rating, r.answers, r.submitted_at, r.duration_seconds
       FROM responses r
       JOIN templates t ON t.id = r.template_id
       JOIN devices d   ON d.id = r.device_id
      WHERE t.owner_id = ?
      ORDER BY r.submitted_at DESC
      LIMIT 200`,
    [req.user.sub],
  );
  res.json({ responses: rows.map((r) => ({ ...r, answers: JSON.parse(r.answers || "{}") })) });
}));

const submitSchema = z.object({
  template_id: z.number().int().positive(),
  device_id: z.number().int().positive(),
  rating: z.number().int().min(0).max(10).nullable().optional(),
  duration_seconds: z.number().int().min(0).max(36000).default(0),
  answers: z.record(z.any()),
});

// Public endpoint called by the Android device when a customer submits a review.
// Validate with a device token in production.
responsesRouter.post("/submit", asyncHandler(async (req, res) => {
  const body = submitSchema.parse(req.body);
  const result = await query(
    `INSERT INTO responses (template_id, device_id, rating, duration_seconds, answers, submitted_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [body.template_id, body.device_id, body.rating ?? null, body.duration_seconds, JSON.stringify(body.answers)],
  );
  await query(`UPDATE devices SET responses_today = responses_today + 1 WHERE id = ?`, [body.device_id]);
  res.status(201).json({ id: result.insertId });
}));
