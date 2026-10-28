// backend/controllers/crm/authController.js
//
// Handlers for backend/routes/crm/authRoutes.js — CrmUser login/session.
// There is deliberately no public registration: the first admin is created
// with `npm run create-admin`, and every other user by an admin through
// /api/crm/sales-team.
import bcrypt from "bcryptjs";
import prisma from "../../config/prisma.js";
import { validate, HttpError } from "../../utils/validate.js";
import { issueSession, clearSession, publicUser, PASSWORD_RULE } from "../../middleware/auth.js";

// Compared against when the email doesn't exist, so response time doesn't
// reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-placeholder", 12);

export const login = async (req, res) => {
  const { email, password } = validate(req.body, {
    email: { type: "email", required: true },
    password: { type: "string", required: true, max: 200 },
  });
  const user = await prisma.crmUser.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) throw new HttpError(401, "Incorrect email or password.");

  issueSession(res, user);
  res.json({ user: publicUser(user) });
};

export const logout = (req, res) => {
  clearSession(res);
  res.json({ ok: true });
};

export const me = (req, res) => res.json({ user: req.user });

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = validate(req.body, {
    currentPassword: { type: "string", required: true, max: 200 },
    newPassword: PASSWORD_RULE,
  });
  const user = await prisma.crmUser.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw new HttpError(400, "Please correct the highlighted fields.", { currentPassword: "Current password is incorrect." });
  }
  const updated = await prisma.crmUser.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(newPassword, 12) },
  });
  // Old sessions are now invalid (password fingerprint changed); keep this one alive.
  issueSession(res, updated);
  res.json({ ok: true });
};
