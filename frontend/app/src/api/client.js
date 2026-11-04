// app/src/api/client.js — the one place that talks to the CRM backend.
//
// The session is an httpOnly cookie set by the server, so nothing is kept in
// localStorage. Cookie-authenticated, state-changing requests must carry the
// X-CRM-Request header (backend CSRF guard). Error responses are
// `{ error, details }`, where `details` maps field names to messages.
export const API_BASE = (import.meta.env.VITE_API_BASE || "/api/crm").replace(/\/$/, "");

// Thrown for responses that belong to a previous sign-in; callers ignore it.
export const STALE = "stale-session";

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// `session` changes on every sign-in/sign-out, so a slow response from a
// previous session can't sign out (or render into) the current one.
let session = 0;
let onUnauthorized = null;
export const newSession = () => { session += 1; };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function api(path, { method = "GET", body, raw = false } = {}) {
  const started = session;
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      credentials: "include",
      headers: { "X-CRM-Request": "1", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Cannot reach the CRM server at ${API_BASE}. Is the backend running?`);
  }
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (started !== session) throw new ApiError(0, STALE);
  if (res.status === 401 && path !== "/auth/login") onUnauthorized?.(data.error || "Please sign in again.");
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status}).`, data.details);
  return data;
}

export const qs = (o) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== "" && v !== undefined && v !== null)).toString();

// Joins per-field messages for places that show a single toast.
export const errorText = (err) => (err.details ? Object.values(err.details).join(" ") : err.message);
