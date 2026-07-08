# CLAUDE.md — project guide for Claude Code

## What this is

Stampede is a paper-trail / document-tracking system: physical documents get a
digital twin at intake (scan + metadata + tracking number + printable QR
sticker). Offices scan the QR to log Receive/Release handoffs, documents
auto-advance along per-doc-type workflow routes with SLAs, requesters track
status publicly, and the custody log powers the signature feature: a
**bottleneck heatmap** (avg dwell time per office) and **stale/overdue
alerts** (documents sitting past their step's SLA).

## Stack — keep it free of everything

- **Server:** Node 22+, Express 4, **`node:sqlite`** (built-in, zero native
  deps — do NOT swap in better-sqlite3 or Prisma), JWT auth (bcryptjs +
  jsonwebtoken), multer uploads, `qrcode` for stickers, optional
  `tesseract.js` for OCR (must stay optional — see `src/lib/ocr.js`).
- **Client:** React 18 + Vite + react-router v6, plain fetch (`src/api.js`),
  hand-written CSS design system in `src/styles.css`. No UI framework.

## Commands

- Server: `cd server && npm run dev` (port 4000) · `npm run seed` (idempotent)
- Client: `cd client && npm run dev` (port 5173, proxies `/api` → 4000)
- Build check: `cd client && npm run build`

## Conventions

- DB schema lives in `server/src/db.js` (CREATE TABLE IF NOT EXISTS style).
  Migrations are manual — if you change schema, note that devs should delete
  `server/stampede.db` and re-seed, or write an ALTER guard.
- `node:sqlite` has no `.transaction()`; use the `transaction(fn)` helper
  exported from `db.js`.
- Tracking numbers: `STP-YYYY-NNNNNN`, generated in `nextTrackingNo()`.
- Custody log is append-only (`custody_events`); document status/current
  office are denormalized onto `documents` for fast lists. Keep both in sync
  inside the actions route.
- Timestamps are stored as SQLite `datetime('now')` (UTC, no Z suffix);
  client appends `Z` in `fmtDate` — keep that in mind for any date math.
- Error responses: `{ error: "human-readable sentence" }`. UI copy is plain,
  sentence case, action-named buttons (see styles/pages for the register).
- Design system: paper `#F6F5F0`, ink navy `#16294B`, stamp red `#B3261E`,
  approved green `#17603F`, manila tan `#E9DFC8`. Fonts: Archivo (display),
  Public Sans (body), IBM Plex Mono (tracking numbers/timestamps). The
  rubber-stamp status badge and dashed "waybill" timeline are the visual
  signature — reuse `StatusStamp` and `Timeline`, don't invent new styles.

## Roadmap (good next tasks, roughly in order)

1. **Admin pages** — manage offices, users, and workflow builder UI
   (backend endpoints already exist in `routes/workflows.js` + `auth.js`).
2. **In-app QR camera scanning** — a scan page using `BarcodeDetector` with
   a `jsQR` fallback, so scan stations don't rely on the phone's camera app.
3. **Notifications** — email (nodemailer + any free SMTP) or in-app bell for
   "document received at your office" and SLA-breach escalations.
4. **Perceptual-hash duplicate detection** — current dedup is exact sha256;
   add image pHash (e.g. `sharp` + dHash) to catch re-scans of the same page.
5. **Reports** — CSV export of the custody log and monthly per-office
   throughput; print-friendly routing slip that includes the QR.
6. **Retention schedules** — per doc_type retention period; archive view and
   disposal queue.
7. **Permissions hardening** — restrict Receive/Release to the office that
   should hold the document; audit who can view scans.
8. **Tests** — start with `node:test` on the analytics dwell-time math and
   the workflow advance logic in the actions route.

## Gotchas

- OCR must never block or crash intake — it runs fire-and-forget after the
  response; keep it that way.
- `/api/files` (scans) requires auth; the public `/api/track` route must
  never leak file paths, user names, or remarks.
- QR stickers encode `${CLIENT_URL}/scan/<trackingNo>` — `CLIENT_URL` comes
  from `server/.env` and must be LAN-reachable for phone scanning.
