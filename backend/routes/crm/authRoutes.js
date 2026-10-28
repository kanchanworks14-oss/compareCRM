// backend/routes/crm/authRoutes.js
//
// CRM login/session endpoints, against the CrmUser model
// (backend/prisma/schema.prisma).
//
//   POST /login     — email + password → httpOnly session cookie
//   POST /logout    — clears the session cookie
//   GET  /me        — current CrmUser
//   POST /password  — change own password (invalidates other sessions)

import express from "express";
import { login, logout, me, changePassword } from "../../controllers/crm/authController.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../utils/rateLimit.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${req.ip}|${String(req.body?.email || "").toLowerCase()}`,
  message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
});

router.post("/login", loginLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.post("/password", requireAuth, changePassword);

export default router;
