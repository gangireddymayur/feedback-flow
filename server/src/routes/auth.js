const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { query } = require("../db.js");
const { signToken, requireAuth } = require("../middleware/auth.js");
const { asyncHandler } = require("../middleware/error.js");

const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const rows = await query("SELECT * FROM admins WHERE email = ? LIMIT 1", [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  if (user.status !== "active") return res.status(403).json({ error: "Account disabled" });
  const token = signToken({ sub: user.id, role: user.role, email: user.email });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}));

authRouter.get("/me", requireAuth(), asyncHandler(async (req, res) => {
  const rows = await query("SELECT id, name, email, role, status FROM admins WHERE id = ?", [req.user.sub]);
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json({ user: rows[0] });
}));

module.exports = { authRouter };
