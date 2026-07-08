import { NavLink, useNavigate } from "react-router-dom";
import { auth } from "../api.js";

export default function Layout({ children }) {
  const navigate = useNavigate();
  const user = auth.user();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Stampede
          <small>Paper that moves</small>
        </div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/intake">Intake</NavLink>
          <NavLink to="/documents">Documents</NavLink>
          <NavLink to="/analytics">Bottlenecks</NavLink>
          <NavLink to="/track" target="_blank">Public tracker ↗</NavLink>
        </nav>
        <div className="spacer" />
        <div className="whoami">
          {user?.name}
          <br />
          {user?.office_name || "No office"} · {user?.role}
          <br />
          <button onClick={() => { auth.clear(); navigate("/login"); }}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
