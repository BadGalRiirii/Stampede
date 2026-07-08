import jwt from "jsonwebtoken";

export const JWT_SECRET =
  process.env.JWT_SECRET || "stampede-dev-secret-change-me";

/** Require a valid Bearer token; attaches req.user = { id, role, office_id, name }. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sign in to continue." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Sign in again." });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN")
    return res.status(403).json({ error: "Admin access required." });
  next();
}
