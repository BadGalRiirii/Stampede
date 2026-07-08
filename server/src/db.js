import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "stampede.db");

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

/** Simple transaction helper (node:sqlite has no built-in one). */
export function transaction(fn) {
  return (...args) => {
    db.exec("BEGIN");
    try {
      const result = fn(...args);
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
}

db.exec(`
CREATE TABLE IF NOT EXISTS offices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'STAFF' CHECK (role IN ('ADMIN','STAFF')),
  office_id INTEGER REFERENCES offices(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  office_id INTEGER NOT NULL REFERENCES offices(id),
  sla_hours INTEGER NOT NULL DEFAULT 24,
  UNIQUE (template_id, seq)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_no TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  sender TEXT,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'IN_TRANSIT'
    CHECK (status IN ('IN_TRANSIT','RECEIVED','COMPLETED','RETURNED','ARCHIVED')),
  template_id INTEGER REFERENCES workflow_templates(id),
  current_step_seq INTEGER NOT NULL DEFAULT 1,
  current_office_id INTEGER REFERENCES offices(id),
  created_by INTEGER REFERENCES users(id),
  file_hash TEXT,
  ocr_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS custody_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  office_id INTEGER REFERENCES offices(id),
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL
    CHECK (action IN ('CREATED','RECEIVED','RELEASED','COMPLETED','RETURNED','NOTE')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_doc ON custody_events (document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_docs_status ON documents (status);
CREATE INDEX IF NOT EXISTS idx_docs_hash ON documents (file_hash);
`);

/** Generate the next tracking number, e.g. STP-2026-000042 */
export function nextTrackingNo() {
  const year = new Date().getFullYear();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM documents WHERE tracking_no LIKE 'STP-' || ? || '-%'`
    )
    .get(String(year));
  const seq = String(row.n + 1).padStart(6, "0");
  return `STP-${year}-${seq}`;
}
