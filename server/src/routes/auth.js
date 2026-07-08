import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { JWT_SECRET, requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  const user = db
    .prepare(
      `SELECT u.*, o.name AS office_name FROM users u
       LEFT JOIN offices o ON o.id = u.office_id WHERE u.email = ?`
    )
    .get(email.toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: "Email or password is incorrect." });

  const payload = {
    id: user.id,
    name: user.name,
    role: user.role,
    office_id: user.office_id,
    office_name: user.office_name,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, user: payload });
});

router.post("/users", requireAuth, requireAdmin, (req, res) => {
  const { name, email, password, role = "STAFF", office_id } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email, and password are required." });
  try {
    const info = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, office_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(name, email.toLowerCase().trim(), bcrypt.hashSync(password, 10), role, office_id || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes("UNIQUE"))
      return res.status(409).json({ error: "That email is already registered." });
    throw e;
  }
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
