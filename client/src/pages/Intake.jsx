import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function Intake() {
  const [workflows, setWorkflows] = useState([]);
  const [form, setForm] = useState({ title: "", doc_type: "", sender: "", remarks: "" });
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.workflows().then((d) => {
      setWorkflows(d.workflows);
      if (d.workflows[0]) setForm((f) => ({ ...f, doc_type: d.workflows[0].doc_type }));
    }).catch((e) => setError(e.message));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (!form.title.trim()) return setError("Give the document a title.");
    setBusy(true); setError(""); setResult(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("file", file);
      const res = await api.createDocument(fd);
      setResult(res);
      setForm({ title: "", doc_type: form.doc_type, sender: "", remarks: "" });
      setFile(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const route = workflows.find((w) => w.doc_type === form.doc_type);

  return (
    <>
      <h1>Intake</h1>
      <p className="hint">Log an incoming document, attach its scan, and print the QR sticker for the physical folder.</p>

      <div className="grid cols-2">
        <div className="card tabbed" data-tab="New document">
          <label htmlFor="title">Title / subject</label>
          <input id="title" value={form.title} onChange={set("title")} placeholder="e.g. PR #2026-114 — Office supplies" />

          <label htmlFor="doc_type">Document type</label>
          <select id="doc_type" value={form.doc_type} onChange={set("doc_type")}>
            {workflows.map((w) => <option key={w.id} value={w.doc_type}>{w.doc_type}</option>)}
            <option value="Other">Other (no routing)</option>
          </select>
          {route && (
            <p className="hint" style={{ marginTop: "-0.5rem" }}>
              Route: {route.steps.map((s) => s.office_name).join(" → ")}
            </p>
          )}

          <label htmlFor="sender">Sender / origin</label>
          <input id="sender" value={form.sender} onChange={set("sender")} placeholder="Office, company, or person" />

          <label htmlFor="remarks">Remarks</label>
          <textarea id="remarks" rows={2} value={form.remarks} onChange={set("remarks")} />

          <label htmlFor="file">Scanned copy (photo or PDF — optional)</label>
          <input id="file" type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0] || null)} />

          {error && <p className="error-note">{error}</p>}
          <button onClick={submit} disabled={busy}>{busy ? "Logging…" : "Log document"}</button>
        </div>

        {result && (
          <div className="card tabbed" data-tab="Print & attach to folder" style={{ textAlign: "center" }}>
            {result.duplicate_of && (
              <p className="error-note">
                Possible duplicate: this exact file was already logged as{" "}
                <Link to={`/documents/${result.duplicate_of.tracking_no}`} className="mono">
                  {result.duplicate_of.tracking_no}
                </Link>{" "}({result.duplicate_of.title}).
              </p>
            )}
            <div className="qr-sticker">
              <img src={result.qr} alt={`QR code for ${result.document.tracking_no}`} width="180" height="180" />
              <div className="no">{result.document.tracking_no}</div>
              <div className="sub">Scan to receive / release</div>
            </div>
            <div className="btn-row" style={{ justifyContent: "center", marginTop: "0.9rem" }}>
              <button className="ghost" onClick={() => window.print()}>Print sticker</button>
              <Link className="btn" to={`/documents/${result.document.tracking_no}`}>Open document</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
