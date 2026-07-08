import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, auth, fmtDate } from "../api.js";
import StatusStamp from "../components/StatusStamp.jsx";
import Timeline from "../components/Timeline.jsx";

export default function DocumentDetail() {
  const { trackingNo } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);

  const load = useCallback(() => {
    api.document(trackingNo).then(setData).catch((e) => setError(e.message));
  }, [trackingNo]);
  useEffect(load, [load]);

  if (error) return <p className="error-note">{error}</p>;
  if (!data) return <p className="hint">Loading…</p>;

  const { document: doc, events, attachments, route, qr } = data;

  const uploadVersion = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.attach(trackingNo, fd);
      setFile(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div className="mono hint">{doc.tracking_no}</div>
          <h1 style={{ marginBottom: "0.2rem" }}>{doc.title}</h1>
          <p className="hint" style={{ margin: 0 }}>
            {doc.doc_type}{doc.sender ? ` · from ${doc.sender}` : ""} · logged {fmtDate(doc.created_at)} by {doc.created_by_name || "—"}
          </p>
        </div>
        <StatusStamp status={doc.status} large />
      </div>

      {route.length > 0 && (
        <div className="route" aria-label="Workflow route">
          {route.map((s, i) => (
            <span key={s.seq} style={{ display: "contents" }}>
              {i > 0 && <span className="arrow">→</span>}
              <span className={`step ${s.seq < doc.current_step_seq ? "done" : s.seq === doc.current_step_seq ? "now" : ""}`}>
                {s.office_name} <span className="mono" style={{ fontSize: "0.68rem" }}>{s.sla_hours}h</span>
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="grid cols-2">
        <div>
          <div className="card tabbed" data-tab="Paper trail">
            <Timeline events={events} />
          </div>

          <div className="card tabbed" data-tab="Scanned versions">
            {attachments.length === 0 ? (
              <p className="hint">No scanned copy yet.</p>
            ) : (
              <table>
                <thead><tr><th>V</th><th>File</th><th>Uploaded</th></tr></thead>
                <tbody>
                  {attachments.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">v{a.version}</td>
                      <td><FileLink att={a} /></td>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: "0.8rem" }}>
              <label htmlFor="version-file">Attach updated scan (after signatures / annotations)</label>
              <input id="version-file" type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
              <button className="ghost" onClick={uploadVersion} disabled={!file}>Upload version</button>
            </div>
          </div>
        </div>

        <div>
          <div className="card tabbed" data-tab="QR sticker" style={{ textAlign: "center" }}>
            <div className="qr-sticker">
              <img src={qr} alt={`QR code for ${doc.tracking_no}`} width="160" height="160" />
              <div className="no">{doc.tracking_no}</div>
              <div className="sub">Scan to receive / release</div>
            </div>
            <div className="btn-row" style={{ justifyContent: "center", marginTop: "0.8rem" }}>
              <button className="ghost" onClick={() => window.print()}>Print</button>
              <Link className="btn ghost" to={`/scan/${doc.tracking_no}`}>Open scan station</Link>
            </div>
          </div>

          {doc.ocr_text && (
            <div className="card tabbed" data-tab="Extracted text (OCR)">
              <p style={{ whiteSpace: "pre-wrap", fontSize: "0.82rem", maxHeight: 260, overflow: "auto" }}>
                {doc.ocr_text}
              </p>
            </div>
          )}
          {doc.remarks && (
            <div className="card tabbed" data-tab="Remarks">
              <p style={{ margin: 0 }}>{doc.remarks}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Fetches the protected file with the auth token and opens it. */
function FileLink({ att }) {
  const open = async () => {
    const res = await fetch(`/api/files/${att.file_path}`, {
      headers: { Authorization: `Bearer ${auth.token()}` },
    });
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  };
  return (
    <button className="ghost" style={{ padding: "0.15rem 0.5rem", fontSize: "0.8rem" }} onClick={open}>
      {att.original_name}
    </button>
  );
}
