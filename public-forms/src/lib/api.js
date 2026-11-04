// public-forms/src/lib/api.js — submit an enquiry to the CRM backend.
//
// The /public endpoints need no login, cookie or key: nothing secret is ever
// in this bundle. The backend validates every field again, rate-limits per IP
// and de-duplicates repeat submissions. Success requires a lead reference in
// the reply, i.e. the lead was saved.
export const API_BASE = (import.meta.env.VITE_API_BASE || "/api/crm").replace(/\/$/, "");

export class SubmitError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details; // { fieldName: "message" } from the backend's validator
  }
}

export async function submitEnquiry(endpoint, body) {
  let res;
  try {
    res = await fetch(API_BASE + endpoint, {
      method: "POST",
      credentials: "omit", // never send a CRM staff session cookie from the public site
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SubmitError("We couldn't reach our server. Please check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) throw new SubmitError(data.error || "Too many submissions. Please try again in a few minutes.");
  if (!res.ok || !data.reference) {
    throw new SubmitError(data.error || `Submission failed (${res.status}). Please try again.`, data.details);
  }
  return data; // { ok, reference, id?, duplicate? }
}
