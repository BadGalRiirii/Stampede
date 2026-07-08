import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

/**
 * The signature feature: the bottleneck heatmap.
 * Every custody handoff is timestamped, so we can show exactly which
 * office documents sit at the longest — and which are overdue right now.
 */
export default function Analytics() {
  const [offices, setOffices] = useState([]);
  const [stale, setStale] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.bottlenecks().then((d) => setOffices(d.offices)).catch((e) => setError(e.message));
    api.stale().then((d) => setStale(d.stale)).catch(() => {});
  }, []);

  const maxAvg = Math.max(1, ...offices.map((o) => o.avg_hours));
  const heatColor = (ratio) =>
    ratio > 0.75 ? "var(--stamp-red)" : ratio > 0.4 ? "#c78a2d" : "var(--approved)";

  return (
    <>
      <h1>Bottlenecks</h1>
      <p className="hint">
        Average time documents sit at each office before being released. Long bars are where your paperwork goes to die.
      </p>
      {error && <p className="error-note">{error}</p>}

      <div className="card tabbed" data-tab="Dwell time by office">
        {offices.length === 0 ? (
          <p className="hint">No handoffs recorded yet. This fills in as offices receive and release documents.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Office</th><th>Avg dwell</th><th></th><th>Longest</th><th>Handled</th><th>Holding now</th></tr>
            </thead>
            <tbody>
              {offices.map((o) => {
                const ratio = o.avg_hours / maxAvg;
                return (
                  <tr key={o.office_id} className="heat-row">
                    <td style={{ fontWeight: 600 }}>{o.office_name}</td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{o.avg_hours}h</td>
                    <td style={{ width: "35%" }}>
                      <div className="heat-bar-wrap">
                        <div className="heat-bar" style={{ width: `${Math.max(4, ratio * 100)}%`, background: heatColor(ratio) }} />
                      </div>
                    </td>
                    <td className="mono">{o.max_hours}h</td>
                    <td className="mono">{o.handled}</td>
                    <td className="mono">{o.still_holding}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card tabbed" data-tab="Overdue right now">
        {stale.length === 0 ? (
          <p className="hint">Nothing is past its SLA.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Tracking no.</th><th>Document</th><th>Sitting at</th><th>Overdue by</th></tr>
            </thead>
            <tbody>
              {stale.map((d) => (
                <tr key={d.tracking_no}>
                  <td className="mono"><Link to={`/documents/${d.tracking_no}`}>{d.tracking_no}</Link></td>
                  <td>{d.title}</td>
                  <td>{d.current_office_name || "—"}</td>
                  <td><span className="stamp OVERDUE">{Math.round(d.overdue_by_hours)}h past SLA</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
