import { Router } from "express";
import { db } from "../db.js";

const router = Router();

/**
 * Public tracking — no sign-in needed. Shows the movement timeline only,
 * never the scanned files. This is what requesters check instead of
 * calling or visiting the office.
 */
router.get("/:trackingNo", (req, res) => {
  const doc = db
    .prepare(
      `SELECT d.tracking_no, d.title, d.doc_type, d.status, d.created_at, d.completed_at,
              o.name AS current_office_name
       FROM documents d LEFT JOIN offices o ON o.id = d.current_office_id
       WHERE d.tracking_no = ?`
    )
    .get(req.params.trackingNo.toUpperCase().trim());

  if (!doc)
    return res.status(404).json({ error: "No document with that tracking number. Check the number and try again." });

  const events = db
    .prepare(
      `SELECT e.action, e.created_at, o.name AS office_name
       FROM custody_events e LEFT JOIN offices o ON o.id = e.office_id
       WHERE e.document_id = (SELECT id FROM documents WHERE tracking_no = ?)
       ORDER BY e.created_at ASC, e.id ASC`
    )
    .all(doc.tracking_no);

  res.json({ document: doc, events });
});

export default router;
