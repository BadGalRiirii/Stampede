import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, auth, fmtDate } from "../api.js";
import StatusStamp from "../components/StatusStamp.jsx";

/**
 * This is the page the QR sticker opens. Staff scan the sticker with any
 * phone camera, land here, and tap one button to log the handoff.
 */
export default function ScanStation() {
  const { trackingNo } = useParams();
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const user = auth.user();

  const load = useCallback(() => {
    api.document(trackingNo).then(setData).catch((e) => setError(e.message));
  }, [trackingNo]);
  useEffect(load, [load]);

  const act = async (action, label) => {
    setError(""); setDone("");
    try {
      await api.action(trackingNo, action, note || undefined);
      setNote("");
      setDone(label);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (error && !data) return <p className="error-note">{error}</p>;
  if (!data) return <p className="hint">Loading…</p>;

  const doc = data.document;
  const closed = ["COMPLETED", "ARCHIVED"].includes(doc.status);

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="mono hint">{doc.tracking_no}</div>
      <h1 style={{ marginBottom: "0.2rem" }}>{doc.title}</h1>
      <p className="hint">
        {doc.doc_type} · now at {doc.current_office_name || "—"} · <StatusStamp status={doc.status} />
      </p>

      <div className="card tabbed" data-tab={`Acting as ${user?.office_name || user?.name}`}>
        {closed ? (
          <p className="hint">This document is closed. Nothing left to log.</p>
        ) : (
          <>
            <label htmlFor="note">Note (optional)</label>
            <input id="note" value={note} onChange={(e) => setNote(e.target.value)}
                   placeholder="e.g. For budget certification" />
            <div className="btn-row">
              <button onClick={() => act("RECEIVED", "Receipt logged.")}>Receive</button>
              <button className="ghost" onClick={() => act("RELEASED", "Release logged — routed to next office.")}>
                Release to next
              </button>
              <button className="good" onClick={() => act("COMPLETED", "Marked completed.")}>Complete</button>
              <button className="danger" onClick={() => act("RETURNED", "Marked returned to sender.")}>Return</button>
            </div>
          </>
        )}
        {done && <p className="hint" style={{ color: "var(--approved)", fontWeight: 600, marginTop: "0.7rem" }}>{done}</p>}
        {error && <p className="error-note">{error}</p>}
      </div>

      <p className="hint">
        Last movement: {data.events.length ? fmtDate(data.events[data.events.length - 1].created_at) : "—"} ·{" "}
        <Link to={`/documents/${doc.tracking_no}`}>Full paper trail</Link>
      </p>
    </div>
  );
}
