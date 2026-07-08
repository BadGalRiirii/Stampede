import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/**
 * Bottleneck heatmap.
 * For every RECEIVED event, dwell time runs until that document's next
 * RELEASED/COMPLETED/RETURNED event (or now, if it's still sitting there).
 * Grouped by office → average and max dwell hours, open vs. closed counts.
 */
router.get("/bottlenecks", (_req, res) => {
  const received = db
    .prepare(
      `SELECT e.id, e.document_id, e.office_id, e.created_at, o.name AS office_name
       FROM custody_events e JOIN offices o ON o.id = e.office_id
       WHERE e.action = 'RECEIVED'`
    )
    .all();

  const nextExit = db.prepare(
    `SELECT created_at FROM custody_events
     WHERE document_id = ? AND id > ? AND action IN ('RELEASED','COMPLETED','RETURNED')
     ORDER BY id LIMIT 1`
  );

  const byOffice = new Map();
  const now = Date.now();

  for (const ev of received) {
    const exit = nextExit.get(ev.document_id, ev.id);
    const start = new Date(ev.created_at + "Z").getTime();
    const end = exit ? new Date(exit.created_at + "Z").getTime() : now;
    const hours = Math.max(0, (end - start) / 36e5);

    const agg = byOffice.get(ev.office_id) || {
      office_id: ev.office_id,
      office_name: ev.office_name,
      total_hours: 0,
      max_hours: 0,
      handled: 0,
      still_holding: 0,
    };
    agg.total_hours += hours;
    agg.max_hours = Math.max(agg.max_hours, hours);
    agg.handled += 1;
    if (!exit) agg.still_holding += 1;
    byOffice.set(ev.office_id, agg);
  }

  const offices = [...byOffice.values()]
    .map((a) => ({
      ...a,
      avg_hours: +(a.total_hours / a.handled).toFixed(1),
      max_hours: +a.max_hours.toFixed(1),
    }))
    .sort((a, b) => b.avg_hours - a.avg_hours);

  res.json({ offices });
});

/**
 * Stale documents: sitting at an office past the step's SLA.
 * Falls back to a 24h default when the document has no workflow.
 */
router.get("/stale", (_req, res) => {
  const open = db
    .prepare(
      `SELECT d.id, d.tracking_no, d.title, d.doc_type, d.status, d.current_step_seq,
              d.template_id, o.name AS current_office_name,
              (SELECT e.created_at FROM custody_events e
               WHERE e.document_id = d.id AND e.action IN ('CREATED','RECEIVED')
               ORDER BY e.id DESC LIMIT 1) AS last_moved_at
       FROM documents d LEFT JOIN offices o ON o.id = d.current_office_id
       WHERE d.status IN ('IN_TRANSIT','RECEIVED')`
    )
    .all();

  const slaOf = db.prepare(
    `SELECT sla_hours FROM workflow_steps WHERE template_id = ? AND seq = ?`
  );

  const now = Date.now();
  const stale = [];
  for (const d of open) {
    if (!d.last_moved_at) continue;
    const sla = d.template_id
      ? slaOf.get(d.template_id, d.current_step_seq)?.sla_hours ?? 24
      : 24;
    const idleHours = (now - new Date(d.last_moved_at + "Z").getTime()) / 36e5;
    if (idleHours > sla) {
      stale.push({
        ...d,
        sla_hours: sla,
        idle_hours: +idleHours.toFixed(1),
        overdue_by_hours: +(idleHours - sla).toFixed(1),
      });
    }
  }
  stale.sort((a, b) => b.overdue_by_hours - a.overdue_by_hours);
  res.json({ stale });
});

/** Dashboard summary counts */
router.get("/summary", (_req, res) => {
  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status IN ('IN_TRANSIT','RECEIVED') THEN 1 ELSE 0 END) AS open,
         SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) AS today
       FROM documents`
    )
    .get();

  const recent = db
    .prepare(
      `SELECT e.action, e.created_at, e.note, d.tracking_no, d.title,
              o.name AS office_name, u.name AS user_name
       FROM custody_events e
       JOIN documents d ON d.id = e.document_id
       LEFT JOIN offices o ON o.id = e.office_id
       LEFT JOIN users u ON u.id = e.user_id
       ORDER BY e.id DESC LIMIT 15`
    )
    .all();

  res.json({ counts, recent });
});

export default router;
