import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { fileURLToPath } from "url";
import { db, nextTrackingNo } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { extractText } from "../lib/ocr.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const router = Router();
router.use(requireAuth);

const docWithJoins = `
  SELECT d.*, o.name AS current_office_name, t.name AS workflow_name,
         u.name AS created_by_name
  FROM documents d
  LEFT JOIN offices o ON o.id = d.current_office_id
  LEFT JOIN workflow_templates t ON t.id = d.template_id
  LEFT JOIN users u ON u.id = d.created_by`;

/** List / search documents */
router.get("/", (req, res) => {
  const { q, status, office_id } = req.query;
  let sql = `${docWithJoins} WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ` AND (d.tracking_no LIKE ? OR d.title LIKE ? OR d.sender LIKE ? OR d.ocr_text LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (status) { sql += ` AND d.status = ?`; params.push(status); }
  if (office_id) { sql += ` AND d.current_office_id = ?`; params.push(office_id); }
  sql += ` ORDER BY d.created_at DESC LIMIT 200`;
  res.json({ documents: db.prepare(sql).all(...params) });
});

/** Intake: create a document, optionally with a scanned file */
router.post("/", upload.single("file"), async (req, res) => {
  const { title, doc_type, sender, remarks } = req.body || {};
  if (!title || !doc_type)
    return res.status(400).json({ error: "Title and document type are required." });

  const template = db
    .prepare(`SELECT * FROM workflow_templates WHERE doc_type = ?`)
    .get(doc_type);
  const firstStep = template
    ? db.prepare(`SELECT * FROM workflow_steps WHERE template_id = ? ORDER BY seq LIMIT 1`).get(template.id)
    : null;

  // Duplicate detection via file hash
  let fileHash = null;
  let duplicateOf = null;
  if (req.file) {
    fileHash = crypto.createHash("sha256").update(fs.readFileSync(req.file.path)).digest("hex");
    duplicateOf = db
      .prepare(`SELECT tracking_no, title FROM documents WHERE file_hash = ?`)
      .get(fileHash) || null;
  }

  const trackingNo = nextTrackingNo();
  const info = db
    .prepare(
      `INSERT INTO documents
         (tracking_no, title, doc_type, sender, remarks, template_id,
          current_step_seq, current_office_id, created_by, file_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_TRANSIT')`
    )
    .run(
      trackingNo, title, doc_type, sender || null, remarks || null,
      template?.id || null, 1,
      firstStep?.office_id || req.user.office_id || null,
      req.user.id, fileHash
    );
  const docId = info.lastInsertRowid;

  db.prepare(
    `INSERT INTO custody_events (document_id, office_id, user_id, action, note)
     VALUES (?, ?, ?, 'CREATED', ?)`
  ).run(docId, req.user.office_id || null, req.user.id,
        `Logged at intake${req.file ? " with scanned copy" : ""}.`);

  if (req.file) {
    db.prepare(
      `INSERT INTO attachments (document_id, file_path, original_name, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(docId, req.file.filename, req.file.originalname, req.file.mimetype, req.user.id);

    // OCR in the background — never blocks the response. tesseract.js's Node
    // recognizer doesn't support PDF input, so skip those rather than pass
    // them through.
    if (req.file.mimetype.startsWith("image/")) {
      extractText(req.file.path).then((text) => {
        if (text) db.prepare(`UPDATE documents SET ocr_text = ? WHERE id = ?`).run(text, docId);
      }).catch((err) => console.warn("[ocr] skipped:", err.message));
    }
  }

  const qrDataUrl = await QRCode.toDataURL(`${CLIENT_URL}/scan/${trackingNo}`, {
    margin: 1, width: 280,
  });

  res.status(201).json({
    document: db.prepare(`${docWithJoins} WHERE d.id = ?`).get(docId),
    qr: qrDataUrl,
    duplicate_of: duplicateOf,
  });
});

/** Detail: document + timeline + attachments + workflow route + QR */
router.get("/:trackingNo", async (req, res) => {
  const doc = db
    .prepare(`${docWithJoins} WHERE d.tracking_no = ?`)
    .get(req.params.trackingNo);
  if (!doc) return res.status(404).json({ error: "No document with that tracking number." });

  const events = db
    .prepare(
      `SELECT e.*, o.name AS office_name, u.name AS user_name
       FROM custody_events e
       LEFT JOIN offices o ON o.id = e.office_id
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.document_id = ? ORDER BY e.created_at ASC, e.id ASC`
    )
    .all(doc.id);

  const attachments = db
    .prepare(`SELECT * FROM attachments WHERE document_id = ? ORDER BY version DESC, id DESC`)
    .all(doc.id);

  const route = doc.template_id
    ? db.prepare(
        `SELECT s.seq, s.sla_hours, o.name AS office_name, o.id AS office_id
         FROM workflow_steps s JOIN offices o ON o.id = s.office_id
         WHERE s.template_id = ? ORDER BY s.seq`
      ).all(doc.template_id)
    : [];

  const qr = await QRCode.toDataURL(`${CLIENT_URL}/scan/${doc.tracking_no}`, {
    margin: 1, width: 280,
  });

  res.json({ document: doc, events, attachments, route, qr });
});

/** Custody actions: receive / release / complete / return / note */
router.post("/:trackingNo/actions", (req, res) => {
  const { action, note } = req.body || {};
  const valid = ["RECEIVED", "RELEASED", "COMPLETED", "RETURNED", "NOTE"];
  if (!valid.includes(action))
    return res.status(400).json({ error: `Action must be one of: ${valid.join(", ")}.` });

  const doc = db
    .prepare(`SELECT * FROM documents WHERE tracking_no = ?`)
    .get(req.params.trackingNo);
  if (!doc) return res.status(404).json({ error: "No document with that tracking number." });
  if (["COMPLETED", "ARCHIVED"].includes(doc.status) && action !== "NOTE")
    return res.status(409).json({ error: "This document is already closed." });

  const officeId = req.user.office_id || null;
  const custodyActions = ["RECEIVED", "RELEASED", "COMPLETED", "RETURNED"];
  if (
    custodyActions.includes(action) &&
    req.user.role !== "ADMIN" &&
    officeId !== doc.current_office_id
  ) {
    return res
      .status(403)
      .json({ error: "Only staff at the office currently holding this document can do that." });
  }

  db.prepare(
    `INSERT INTO custody_events (document_id, office_id, user_id, action, note)
     VALUES (?, ?, ?, ?, ?)`
  ).run(doc.id, officeId, req.user.id, action, note || null);

  if (action === "RECEIVED") {
    db.prepare(
      `UPDATE documents SET status = 'RECEIVED', current_office_id = ? WHERE id = ?`
    ).run(officeId, doc.id);
  } else if (action === "RELEASED") {
    // Advance to the next step in the workflow, if one exists
    let nextOffice = null;
    let nextSeq = doc.current_step_seq;
    if (doc.template_id) {
      const next = db
        .prepare(
          `SELECT s.*, o.name AS office_name FROM workflow_steps s
           JOIN offices o ON o.id = s.office_id
           WHERE s.template_id = ? AND s.seq > ? ORDER BY s.seq LIMIT 1`
        )
        .get(doc.template_id, doc.current_step_seq);
      if (next) { nextOffice = next.office_id; nextSeq = next.seq; }
    }
    db.prepare(
      `UPDATE documents SET status = 'IN_TRANSIT', current_step_seq = ?, current_office_id = COALESCE(?, current_office_id)
       WHERE id = ?`
    ).run(nextSeq, nextOffice, doc.id);
  } else if (action === "COMPLETED") {
    db.prepare(
      `UPDATE documents SET status = 'COMPLETED', completed_at = datetime('now') WHERE id = ?`
    ).run(doc.id);
  } else if (action === "RETURNED") {
    db.prepare(`UPDATE documents SET status = 'RETURNED' WHERE id = ?`).run(doc.id);
  }

  res.json({ ok: true });
});

/** Attach a new scanned version */
router.post("/:trackingNo/attachments", upload.single("file"), (req, res) => {
  const doc = db.prepare(`SELECT * FROM documents WHERE tracking_no = ?`).get(req.params.trackingNo);
  if (!doc) return res.status(404).json({ error: "No document with that tracking number." });
  if (!req.file) return res.status(400).json({ error: "Attach a file to upload." });

  const last = db
    .prepare(`SELECT MAX(version) AS v FROM attachments WHERE document_id = ?`)
    .get(doc.id);
  db.prepare(
    `INSERT INTO attachments (document_id, file_path, original_name, mime_type, version, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(doc.id, req.file.filename, req.file.originalname, req.file.mimetype, (last.v || 0) + 1, req.user.id);

  db.prepare(
    `INSERT INTO custody_events (document_id, office_id, user_id, action, note)
     VALUES (?, ?, ?, 'NOTE', ?)`
  ).run(doc.id, req.user.office_id || null, req.user.id, `Uploaded new version: ${req.file.originalname}`);

  res.status(201).json({ ok: true });
});

export default router;
