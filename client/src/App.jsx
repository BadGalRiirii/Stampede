import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { auth } from "./api.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Intake from "./pages/Intake.jsx";
import Documents from "./pages/Documents.jsx";
import DocumentDetail from "./pages/DocumentDetail.jsx";
import ScanStation from "./pages/ScanStation.jsx";
import Track from "./pages/Track.jsx";
import Analytics from "./pages/Analytics.jsx";

function Protected({ children }) {
  const location = useLocation();
  if (!auth.token())
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public: requesters check status here, no sign-in */}
      <Route path="/track" element={<Track />} />
      <Route path="/track/:trackingNo" element={<Track />} />

      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/intake" element={<Protected><Intake /></Protected>} />
      <Route path="/documents" element={<Protected><Documents /></Protected>} />
      <Route path="/documents/:trackingNo" element={<Protected><DocumentDetail /></Protected>} />
      <Route path="/scan/:trackingNo" element={<Protected><ScanStation /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
