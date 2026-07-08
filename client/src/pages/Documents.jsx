import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate } from "../api.js";
import StatusStamp from "../components/StatusStamp.jsx";

export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    const params = {};
    if (q) params.q = q;
    if (status) params.status = status;
    api.documents(params).then((d) => setDocs(d.documents)).catch((e) => setError(e.message));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1>Documents</h1>
      <div className="card">
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <input
            style={{ flex: 2, minWidth: 200, marginBottom: 0 }}
            placeholder="Search title, tracking no., sender — or full text of scans"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            aria-label="Search documents"
          />
          <select style={{ flex: 1, minWidth: 140, marginBottom: 0 }} value={status}
                  onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="IN_TRANSIT">In transit</option>
            <option value="RECEIVED">Received</option>
            <option value="COMPLETED">Completed</option>
            <option value="RETURNED">Returned</option>
          </select>
          <button onClick={load}>Search</button>
        </div>
      </div>

      {error && <p className="error-note">{error}</p>}
      <div className="card">
        {docs.length === 0 ? (
          <p className="hint">No documents match. Log one from the Intake page.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Tracking no.</th><th>Document</th><th>Status</th><th>Now at</th><th>Logged</th></tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="mono"><Link to={`/documents/${d.tracking_no}`}>{d.tracking_no}</Link></td>
                  <td>
                    {d.title}
                    <div className="hint">{d.doc_type}{d.sender ? ` · from ${d.sender}` : ""}</div>
                  </td>
                  <td><StatusStamp status={d.status} /></td>
                  <td>{d.current_office_name || "—"}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
