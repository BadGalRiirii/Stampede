import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, auth } from "../api.js";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const { token, user } = await api.login(email, password);
      auth.save(token, user);
      navigate(location.state?.from || "/", { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="brand" style={{ color: "var(--ink)", marginBottom: "1rem" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2rem" }}>Stampede</span>
        <small style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "0.68rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
          Paper that moves
        </small>
      </div>
      <div className="card tabbed" data-tab="Sign in">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && submit()} />
        {error && <p className="error-note">{error}</p>}
        <button onClick={submit} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="hint" style={{ marginTop: "0.8rem" }}>
          Seeded admin: <span className="mono">admin@stampede.local / admin123</span>
        </p>
      </div>
    </div>
  );
}
