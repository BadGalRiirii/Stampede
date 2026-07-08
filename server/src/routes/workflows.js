import { Router } from "express";
import { db, transaction } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/offices", (_req, res) => {
  res.json({ offices: db.prepare(`SELECT * FROM offices ORDER BY name`).all() });
});

router.post("/offices", requireAdmin, (req, res) => {
  const { name, code } = req.body || {};
  if (!name || !code) return res.status(400).json({ error: "Name and code are required." });
  try {
    const info = db.prepare(`INSERT INTO offices (name, code) VALUES (?, ?)`).run(name, code.toUpperCase());
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes("UNIQUE"))
      return res.status(409).json({ error: "An office with that name or code already exists." });
    throw e;
  }
});

router.get("/", (_req, res) => {
  const templates = db.prepare(`SELECT * FROM workflow_templates ORDER BY name`).all();
  const steps = db
    .prepare(
      `SELECT s.*, o.name AS office_name FROM workflow_steps s
       JOIN offices o ON o.id = s.office_id ORDER BY s.template_id, s.seq`
    )
    .all();
  res.json({
    workflows: templates.map((t) => ({
      ...t,
      steps: steps.filter((s) => s.template_id === t.id),
    })),
  });
});

/** Create a workflow with its steps in one call.
 *  Body: { name, doc_type, steps: [{ office_id, sla_hours }] } */
router.post("/", requireAdmin, (req, res) => {
  const { name, doc_type, steps } = req.body || {};
  if (!name || !doc_type || !Array.isArray(steps) || steps.length === 0)
    return res.status(400).json({ error: "Name, document type, and at least one step are required." });

  const create = transaction(() => {
    const info = db
      .prepare(`INSERT INTO workflow_templates (name, doc_type) VALUES (?, ?)`)
      .run(name, doc_type);
    steps.forEach((s, i) => {
      db.prepare(
        `INSERT INTO workflow_steps (template_id, seq, office_id, sla_hours) VALUES (?, ?, ?, ?)`
      ).run(info.lastInsertRowid, i + 1, s.office_id, s.sla_hours || 24);
    });
    return info.lastInsertRowid;
  });

  try {
    res.status(201).json({ id: create() });
  } catch (e) {
    if (String(e.message).includes("UNIQUE"))
      return res.status(409).json({ error: "A workflow for that document type already exists." });
    throw e;
  }
});

export default router;
