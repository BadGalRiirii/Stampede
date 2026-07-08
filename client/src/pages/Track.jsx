import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import StatusStamp from "../components/StatusStamp.jsx";
import Timeline from "../components/Timeline.jsx";

/** Public tracking — like a parcel tracker, but for paperwork. No sign-in. */
export default function Track() {
  const { trackingNo } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(trackingNo || "");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!trackingNo) return;
    setError(""); setData(null);
    api.track(trackingNo).then(setData).catch((e) => setError(e.message));
  }, [trackingNo]);

  const go = () => {
    const no = input.trim().toUpperCase();
    if (no) navigate(`/track/${no}`);
  };

  return (
    <div className="track-hero">
      <div className="brand-lg">
        Stampede
        <small>Track your document</small>
      </div>
      <div className="card" style={{ marginTop: "1.2rem" }}>
        <label htmlFor="tno">Tracking number</label>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <input id="tno" className="mono" style={{ marginBottom: 0 }} placeholder="STP-2026-000001"
                 value={input} onChange={(e) => setInput(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && go()} />
          <button onClick={go}>Track</button>
        </div>
        <p className="hint" style={{ marginTop: "0.6rem", marginBottom: 0 }}>
          The number is on the receipt slip you were given at the receiving desk.
        </p>
      </div>

      {error && <p className="error-note">{error}</p>}

      {data && (
        <div className="card tabbed" data-tab="Where it's been">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
            <div>
              <div className="mono hint">{data.document.tracking_no}</div>
              <h2 style={{ margin: 0 }}>{data.document.title}</h2>
              <p className="hint" style={{ margin: 0 }}>
                {data.document.doc_type} · currently at {data.document.current_office_name || "—"}
              </p>
            </div>
            <StatusStamp status={data.document.status} large />
          </div>
          <Timeline events={data.events} />
        </div>
      )}
    </div>
  );
}
