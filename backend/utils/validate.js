// backend/utils/validate.js — small, dependency-free request validation.
//
// validate(body, spec) returns clean data or throws HttpError(400) with a
// per-field error map the frontend can show next to each input.

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Strips control characters and trims; keeps newlines only where allowed.
const clean = (v, multiline) =>
  String(v)
    .replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, "")
    .trim();

const checkField = (raw, rule) => {
  const empty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
  if (empty) return rule.required ? { error: "This field is required." } : { value: rule.default ?? null };

  switch (rule.type) {
    case "string":
    case "text": {
      if (typeof raw !== "string" && typeof raw !== "number") return { error: "Must be text." };
      const v = clean(raw, rule.type === "text");
      if (rule.min && v.length < rule.min) return { error: `Must be at least ${rule.min} characters.` };
      if (v.length > (rule.max ?? 200)) return { error: `Must be at most ${rule.max ?? 200} characters.` };
      if (rule.pattern && !rule.pattern.test(v)) return { error: rule.patternMessage || "Invalid format." };
      return { value: v };
    }
    case "email": {
      const v = clean(raw).toLowerCase();
      if (v.length > 254 || !EMAIL_RE.test(v)) return { error: "Enter a valid email address." };
      return { value: v };
    }
    case "phone": {
      const v = clean(raw);
      const digits = v.replace(/\D/g, "");
      if (!/^\+?[0-9 ()-]+$/.test(v) || digits.length < 10 || digits.length > 15) {
        return { error: "Enter a valid phone number (10–15 digits)." };
      }
      return { value: v };
    }
    case "enum": {
      const v = clean(raw);
      if (!rule.values.includes(v)) return { error: `Must be one of: ${rule.values.join(", ")}.` };
      return { value: v };
    }
    case "int": {
      const n = Number(raw);
      if (!Number.isInteger(n)) return { error: "Must be a whole number." };
      if (rule.min !== undefined && n < rule.min) return { error: `Must be at least ${rule.min}.` };
      if (rule.max !== undefined && n > rule.max) return { error: `Must be at most ${rule.max}.` };
      return { value: n };
    }
    case "date": {
      const d = new Date(raw);
      if (typeof raw !== "string" || Number.isNaN(d.getTime())) return { error: "Enter a valid date." };
      return { value: d };
    }
    case "bool":
      if (typeof raw !== "boolean") return { error: "Must be true or false." };
      return { value: raw };
    case "uuid": {
      const v = clean(raw);
      if (!UUID_RE.test(v)) return { error: "Invalid id." };
      return { value: v };
    }
    case "url": {
      const v = clean(raw);
      try {
        const u = new URL(v);
        if (!["http:", "https:"].includes(u.protocol) || v.length > (rule.max ?? 500)) throw new Error();
        return { value: v };
      } catch {
        return { error: "Must be a valid http(s) URL." };
      }
    }
    default:
      throw new Error(`Unknown rule type ${rule.type}`);
  }
};

export const validate = (body, spec) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Request body must be a JSON object.");
  const data = {};
  const errors = {};
  for (const [field, rule] of Object.entries(spec)) {
    if (!(field in body) && rule.optionalKey) continue; // PATCH: absent means "don't change"
    const { value, error } = checkField(body[field], rule);
    if (error) errors[field] = error;
    else data[field] = value;
  }
  if (Object.keys(errors).length) throw new HttpError(400, "Please correct the highlighted fields.", errors);
  return data;
};

export const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
