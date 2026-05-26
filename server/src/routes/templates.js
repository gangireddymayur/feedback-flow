import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

export const templatesRouter = Router();

const questionSchema = z.object({
  id: z.string(),
  type: z.enum([
    "short_text", "long_text", "rating", "nps",
    "multiple_choice", "single_choice", "yes_no", "emoji",
  ]),
  label: z.string().min(1).max(500),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(200)).max(20).optional(),
});

const templateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  category: z.string().max(100).default("General"),
  status: z.enum(["active", "inactive", "draft"]).default("draft"),
  questions: z.array(questionSchema).max(100),
});

templatesRouter.get("/", requireAuth(), asyncHandler(async (req, res) => {
  const rows = await query(
    "SELECT id, name, description, category, status, questions, created_at, updated_at FROM templates WHERE owner_id = ? ORDER BY updated_at DESC",
    [req.user.sub],
  );
  res.json({ templates: rows.map((r) => ({ ...r, questions: JSON.parse(r.questions || "[]") })) });
}));

templatesRouter.get("/:id", requireAuth(), asyncHandler(async (req, res) => {
  const rows = await query("SELECT * FROM templates WHERE id = ? AND owner_id = ?", [req.params.id, req.user.sub]);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json({ template: { ...rows[0], questions: JSON.parse(rows[0].questions || "[]") } });
}));

templatesRouter.post("/", requireAuth(), asyncHandler(async (req, res) => {
  const body = templateSchema.parse(req.body);
  const result = await query(
    `INSERT INTO templates (owner_id, name, description, category, status, questions)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.user.sub, body.name, body.description, body.category, body.status, JSON.stringify(body.questions)],
  );
  res.status(201).json({ id: result.insertId });
}));

templatesRouter.put("/:id", requireAuth(), asyncHandler(async (req, res) => {
  const body = templateSchema.parse(req.body);
  await query(
    `UPDATE templates SET name=?, description=?, category=?, status=?, questions=?, updated_at=NOW()
     WHERE id=? AND owner_id=?`,
    [body.name, body.description, body.category, body.status, JSON.stringify(body.questions), req.params.id, req.user.sub],
  );
  res.json({ ok: true });
}));

templatesRouter.delete("/:id", requireAuth(), asyncHandler(async (req, res) => {
  await query("DELETE FROM templates WHERE id=? AND owner_id=?", [req.params.id, req.user.sub]);
  res.json({ ok: true });
}));
