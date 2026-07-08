import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import documentRoutes from "./routes/documents.js";
import trackingRoutes from "./routes/tracking.js";
import workflowRoutes from "./routes/workflows.js";
import analyticsRoutes from "./routes/analytics.js";
import { requireAuth } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "Stampede API" }));

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/track", trackingRoutes);      // public — no auth
app.use("/api/workflows", workflowRoutes);
app.use("/api/analytics", analyticsRoutes);

// Scanned files require sign-in
app.use("/api/files", requireAuth, express.static(path.join(__dirname, "..", "uploads")));

// Central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Stampede API running on http://localhost:${PORT}`));
