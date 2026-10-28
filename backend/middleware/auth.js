// backend/middleware/auth.js — CrmUser session + role authorization.
//
// Sessions are a signed JWT in an httpOnly cookie. The token only carries the
// user id and a fingerprint of the stored password hash; role and isActive
// are re-read from the database on every request, so deactivating a user,
// changing their role or resetting their password takes effect immediately.
import "dotenv/config";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import { HttpError } from "../utils/validate.js";

export const ROLES = { ADMIN: "admin", MANAGER: "sales_manager", REP: "sales_rep" };
export const SESSION_COOKIE = "crm_session";

const SESSION_HOURS = Number(process.env.SESSION_HOURS) || 8;
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set in backend/.env (at least 32 random characters).");
}

const passwordVersion = (hash) => crypto.createHash("sha256").update(hash).digest("base64url").slice(0, 16);

export const cookieOptions = () => {
  const sameSite = (process.env.COOKIE_SAMESITE || "strict").toLowerCase();
  return {
    httpOnly: true,
    // SameSite=None is only accepted by browsers on Secure cookies.
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    path: "/api/crm",
  };
};

export const publicUser = (u) => ({ id: u.id, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt });

export const issueSession = (res, user) => {
  const token = jwt.sign({ pv: passwordVersion(user.password) }, SECRET, {
    subject: user.id,
    expiresIn: `${SESSION_HOURS}h`,
    algorithm: "HS256",
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_HOURS * 3600 * 1000 });
};

export const clearSession = (res) => res.clearCookie(SESSION_COOKIE, cookieOptions());

export const requireAuth = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) throw new HttpError(401, "Please sign in.");
  let payload;
  try {
    payload = jwt.verify(token, SECRET, { algorithms: ["HS256"] });
  } catch {
    clearSession(res);
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
  const user = await prisma.crmUser.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive || payload.pv !== passwordVersion(user.password)) {
    clearSession(res);
    throw new HttpError(401, "Your session is no longer valid. Please sign in again.");
  }
  req.user = publicUser(user);
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) throw new HttpError(403, "You do not have permission to do this.");
  next();
};

// Cookie-authenticated, state-changing requests must carry a custom header.
// Browsers can't add it cross-origin without a CORS preflight, which our
// origin allowlist rejects — a CSRF guard on top of SameSite cookies.
export const requireCsrfHeader = (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("x-crm-request") !== "1") {
    throw new HttpError(403, "Missing X-CRM-Request header.");
  }
  next();
};

// Prisma `where` fragment limiting a user to the leads they may see.
// Sales reps: only leads assigned to them. Managers/admins: all leads —
// CrmUser has no team/manager relation yet, so the whole sales team is
// treated as one team (see README "Known limitations").
export const leadScope = (user) => (user.role === ROLES.REP ? { assignedTo: user.id } : {});

export const PASSWORD_RULE = {
  type: "string",
  required: true,
  min: 10,
  max: 72, // bcrypt only uses the first 72 bytes
  pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/,
  patternMessage: "Use at least one letter and one number.",
};
