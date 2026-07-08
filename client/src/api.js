/** Tiny API client. Token lives in localStorage under "stampede_token". */
const TOKEN_KEY = "stampede_token";
const USER_KEY = "stampede_user";

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: () => JSON.parse(localStorage.getItem(USER_KEY) || "null"),
  save: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function request(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = auth.token();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: form ? form : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  summary: () => request("/analytics/summary"),
  bottlenecks: () => request("/analytics/bottlenecks"),
  stale: () => request("/analytics/stale"),
  documents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/documents${q ? `?${q}` : ""}`);
  },
  document: (trackingNo) => request(`/documents/${trackingNo}`),
  createDocument: (form) => request("/documents", { method: "POST", form }),
  action: (trackingNo, action, note) =>
    request(`/documents/${trackingNo}/actions`, { method: "POST", body: { action, note } }),
  attach: (trackingNo, form) =>
    request(`/documents/${trackingNo}/attachments`, { method: "POST", form }),
  track: (trackingNo) => request(`/track/${trackingNo}`),
  workflows: () => request("/workflows"),
  offices: () => request("/workflows/offices"),
};

export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
