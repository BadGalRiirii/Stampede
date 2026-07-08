import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate } from "../api.js";
import StatusStamp from "../components/StatusStamp.jsx";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [stale, setStale] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.summary().then(setSummary).catch((e) => setError(e.message));
    api.stale().then((d) => setStale(d.stale)).catch(() => {});
  }, []);

  if (error) return <p className="error-note">{error}</p>;

  return (
    <>
      <h1>Dashboard</h1>
      <div className="grid cols-4">
        {[
          ["Logged today", summary?.counts.today],
          ["Open documents", summary?.counts.open],
          ["Completed", summary?.counts.completed],
          ["Total on record", summary?.counts.total],
        ].map(([label, num]) => (
          <div className="card kpi" key={label}>
            <div className="num">{num ?? "—"}</div>
            <div className="label">{label}</div>
          </div>
        ))}
      </div>

      <div className="card tabbed" data-tab="Overdue — needs a nudge">
        {stale.length === 0 ? (
          <p className="hint">Nothing is overdue. Every document is moving on time.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Tracking no.</th><th>Document</th><th>Sitting at</th><th>Idle</th><th>SLA</th></tr>
            </thead>
            <tbody>
              {stale.map((d) => (
                <tr key={d.tracking_no}>
                  <td className="mono"><Link to={`/documents/${d.tracking_no}`}>{d.tracking_no}</Link></td>
                  <td>{d.title}</td>
                  <td>{d.current_office_name || "—"}</td>
                  <td><span className="stamp OVERDUE">{Math.round(d.idle_hours)}h idle</span></td>
                  <td className="mono">{d.sla_hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card tabbed" data-tab="Recent movement">
        {!summary?.recent?.length ? (
          <p className="hint">No activity yet. Log your first document from the Intake page.</p>
        ) : (
          <table>
            <thead>
              <tr><th>When</th><th>Action</th><th>Document</th><th>Office</th><th>By</th></tr>
            </thead>
            <tbody>
              {summary.recent.map((e, i) => (
                <tr key={i}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(e.created_at)}</td>
                  <td><StatusStamp status={e.action === "CREATED" ? "IN_TRANSIT" : e.action} /></td>
                  <td>
                    <Link to={`/documents/${e.tracking_no}`} className="mono">{e.tracking_no}</Link>
                    <div className="hint">{e.title}</div>
                  </td>
                  <td>{e.office_name || "—"}</td>
                  <td>{e.user_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
