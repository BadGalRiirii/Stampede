import { fmtDate } from "../api.js";

const VERBS = {
  CREATED: "Logged at intake",
  RECEIVED: "Received by",
  RELEASED: "Released by",
  COMPLETED: "Completed at",
  RETURNED: "Returned to sender by",
  NOTE: "Note from",
};

export default function Timeline({ events }) {
  if (!events?.length) return <p className="hint">No movement recorded yet.</p>;
  return (
    <ol className="timeline">
      {[...events].reverse().map((e, i) => (
        <li
          key={i}
          className={
            e.action === "COMPLETED" ? "green" :
            e.action === "RETURNED" ? "red" : ""
          }
        >
          <div className="when mono">{fmtDate(e.created_at)}</div>
          <div className="what">
            {VERBS[e.action] || e.action} {e.office_name || "—"}
            {e.user_name ? ` · ${e.user_name}` : ""}
          </div>
          {e.note && <div className="note">{e.note}</div>}
        </li>
      ))}
    </ol>
  );
}
