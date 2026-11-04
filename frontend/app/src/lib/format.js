// app/src/lib/format.js — small display helpers.
import { SOURCE_LABEL } from "./constants.js";

export const cap = (s = "") => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const initials = (n = "?") =>
  n.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";

// Lead type → UI label; the CSS class is the type itself (cat-agent, ...).
export const typeLabel = (t) => ({ customer: "Customer", developer: "Developer", agent: "Agent", owner: "Owner" }[t] || cap(t));
export const typeClass = (t) => t;

export const sourceLabel = (s) => SOURCE_LABEL[s] || s || "—";

export const dateLabel = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const dateTimeLabel = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const meta = (l) => (l.metadata && typeof l.metadata === "object" && !Array.isArray(l.metadata) ? l.metadata : {});
export const interestOf = (l) => l.propertyTitle || meta(l).location || meta(l).projectLocation || "—";

// <input type="datetime-local"> value → ISO string for the API.
export const toIso = (local) => (local ? new Date(local).toISOString() : "");

// FormData → plain object with trimmed strings.
export const formBody = (form) =>
  Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
