// backend/utils/rateLimit.js — in-memory fixed-window rate limiter.
// Good enough for a single server process. If the CRM is ever run on more
// than one instance, swap this for a shared store (e.g. Redis).
import { HttpError } from "./validate.js";

export const rateLimit = ({ windowMs, max, key = (req) => req.ip, message = "Too many requests. Please try again later." }) => {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, message));
    }
    next();
  };
};
