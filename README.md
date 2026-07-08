# Stampede — Paper Trail & Document Tracking System

Every physical document gets a digital twin. Scan it at intake, print a QR
sticker for the folder, and every office that touches it logs the handoff
with one tap. Requesters track their paperwork like a parcel — and admins
see exactly which office is the bottleneck.

**Free of everything:** Node.js + built-in SQLite (no database server, no
cloud account, no paid API). React + Vite frontend. OCR via tesseract.js
(optional, also free).

## Features

- **Intake with digital twin** — log a document, attach the scan (photo or
  PDF), get an auto-generated tracking number (`STP-2026-000001`) and a
  printable QR sticker for the physical folder.
- **QR scan stations** — scanning the sticker with any phone camera opens
  the scan station page: Receive / Release / Complete / Return in one tap.
  Every handoff is timestamped with who, where, and when.
- **Workflow routing** — each document type follows a defined route
  (e.g. Receiving → Budget → Accounting → Director) with an SLA per step.
  Releasing a document automatically advances it to the next office.
- **Public tracker** — requesters check status at `/track` with just the
  tracking number. No account needed. No more "follow-up" visits.
- **Bottleneck heatmap (signature feature)** — average dwell time per
  office computed from the custody log, plus a live list of documents
  sitting past their SLA. The trail becomes accountability analytics.
- **Duplicate detection** — re-scanned files are flagged by content hash.
- **OCR full-text search** — scanned text is extracted in the background
  and becomes searchable (optional; needs `tesseract.js` installed).
- **Version history** — attach the newly-signed scan at each step so the
  digital twin keeps up with the paper.

## Quick start

Requires **Node.js 22.5+** (uses the built-in `node:sqlite`).

```bash
# Terminal 1 — API
cd server
npm install            # add tesseract.js later if you want OCR
npm run seed           # creates offices, users, and sample workflows
npm run dev            # http://localhost:4000

# Terminal 2 — Web app
cd client
npm install
npm run dev            # http://localhost:5173
```

Sign in with the seeded admin: `admin@stampede.local / admin123`
(also `rina@`, `marco@`, `ana@stampede.local` with `staff123`, each assigned
to a different office so you can simulate handoffs).

To try the whole loop: **Intake** → log a document → open the QR /
document page → **Scan station** → Receive, then Release (it advances to
the next office in the route) → sign in as the next office's user and
repeat → watch the **Bottlenecks** page fill in → check the **public
tracker** at `/track` in an incognito window.

### Enabling OCR

```bash
cd server && npm install tesseract.js
```

First run downloads English language data (needs internet once). If it's
not installed, everything else still works — scans just aren't text-searchable.

### QR scanning from a phone on the same Wi-Fi

Set `CLIENT_URL` in `server/.env` to your machine's LAN address
(e.g. `http://192.168.1.10:5173`) and run Vite with `--host` so the QR
stickers encode a URL your phone can reach.

## Real-world deployment (e.g., a government office)

Everything above describes running Stampede on one machine for development.
Actually putting this in front of a records office / multiple offices in a
building needs a few more pieces — none of them are built yet, so treat this
as a setup checklist, not a "click deploy" button.

**Network scope — pick one:**
- **Single office, LAN-only (simplest, most realistic first step).** Run the
  server on one PC or a small on-prem box on the office's local network.
  Set `CLIENT_URL` in `server/.env` to that machine's LAN IP (e.g.
  `http://10.0.5.20:5173`) so QR stickers resolve for anyone on the same
  network, and serve the client with `vite --host` (or a built static
  bundle). No domain or internet exposure needed — this matches how the app
  already works today (see "QR scanning from a phone on the same Wi-Fi"
  above), just on real office hardware instead of a laptop.
- **Multiple buildings / agency-wide.** Needs a real **domain name** (or at
  minimum an internal DNS entry on the agency's network) pointing at wherever
  the server runs, plus **HTTPS** — put a reverse proxy (Caddy or nginx) in
  front of Express to terminate TLS and serve the built React app and `/api`
  from the same origin. Should sit on the agency's intranet or behind a VPN,
  not the open internet, given this handles internal document custody data.

**Things this checklist assumes you'll add, since they don't exist in the
repo today:**
- A process manager (`pm2`, a systemd unit, or a container) so the API
  restarts on crash/reboot — right now it only runs via `npm run dev` in a
  terminal.
- A real `JWT_SECRET` in `server/.env` — the default in `.env.example` is a
  placeholder and must not be used outside a laptop demo.
- A backup job for `server/stampede.db` (+ its `-wal`/`-shm` files) and
  `server/uploads/` — this is a single SQLite file with no replication, so
  "backup" means literally copying that file on a schedule.
- Basic firewalling so `/api/files` and the DB file are not reachable from
  outside the office network.

## Project layout

```
server/            Express API + SQLite (node:sqlite, zero native deps)
  src/db.js        Schema + tracking number generator + transactions
  src/routes/      auth, documents, tracking (public), workflows, analytics
  src/lib/ocr.js   Optional tesseract.js text extraction
  uploads/         Scanned files (gitignored)
client/            React + Vite
  src/pages/       Dashboard, Intake, Documents, DocumentDetail,
                   ScanStation, Track (public), Analytics
  src/components/  Layout, StatusStamp, Timeline
```

## API sketch

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/login | — | Sign in, returns JWT |
| GET | /api/documents?q=&status= | ✓ | Search (incl. OCR text) |
| POST | /api/documents | ✓ | Intake (multipart, optional `file`) |
| GET | /api/documents/:trackingNo | ✓ | Detail + trail + route + QR |
| POST | /api/documents/:trackingNo/actions | ✓ | RECEIVED / RELEASED / COMPLETED / RETURNED / NOTE |
| POST | /api/documents/:trackingNo/attachments | ✓ | New scanned version |
| GET | /api/track/:trackingNo | public | Movement timeline only |
| GET | /api/workflows, /api/workflows/offices | ✓ | Routes and offices (POST = admin) |
| GET | /api/analytics/bottlenecks · /stale · /summary | ✓ | Heatmap, overdue, dashboard |

## License

MIT — do whatever you want with it.
