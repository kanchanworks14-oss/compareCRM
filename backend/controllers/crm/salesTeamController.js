// backend/controllers/crm/salesTeamController.js
//
// Handlers for backend/routes/crm/salesTeamRoutes.js — CrmUser (sales
// team) management. Only admins create/modify users; managers can read the
// roster so they can assign leads.
import bcrypt from "bcryptjs";
import prisma from "../../config/prisma.js";
import { validate, HttpError, isUuid } from "../../utils/validate.js";
import { ROLES, publicUser, PASSWORD_RULE } from "../../middleware/auth.js";

const ROLE_VALUES = Object.values(ROLES);

export const listUsers = async (req, res) => {
  const users = await prisma.crmUser.findMany({ orderBy: [{ isActive: "desc" }, { email: "asc" }] });
  const counts = await prisma.lead.groupBy({ by: ["assignedTo", "stage"], where: { assignedTo: { not: null } }, _count: true });
  const stats = {};
  for (const c of counts) {
    const s = (stats[c.assignedTo] ??= { assigned: 0, byStage: {} });
    s.assigned += c._count;
    s.byStage[c.stage] = c._count;
  }
  res.json({ users: users.map((u) => ({ ...publicUser(u), leadStats: stats[u.id] ?? { assigned: 0, byStage: {} } })) });
};

export const createUser = async (req, res) => {
  const data = validate(req.body, {
    email: { type: "email", required: true },
    role: { type: "enum", values: ROLE_VALUES, required: true },
    password: PASSWORD_RULE,
  });
  if (await prisma.crmUser.findUnique({ where: { email: data.email } })) {
    throw new HttpError(409, "A user with this email already exists.", { email: "Already in use." });
  }
  const user = await prisma.crmUser.create({
    data: { email: data.email, role: data.role, password: await bcrypt.hash(data.password, 12) },
  });
  res.status(201).json({ user: publicUser(user) });
};

export const updateUser = async (req, res) => {
  if (!isUuid(req.params.id)) throw new HttpError(404, "User not found.");
  const data = validate(req.body, {
    role: { type: "enum", values: ROLE_VALUES, optionalKey: true },
    isActive: { type: "bool", optionalKey: true },
    password: { ...PASSWORD_RULE, optionalKey: true },
  });
  const target = await prisma.crmUser.findUnique({ where: { id: req.params.id } });
  if (!target) throw new HttpError(404, "User not found.");

  // Never let an admin lock the workspace out by demoting/deactivating the last active admin.
  const losesAdmin = target.role === ROLES.ADMIN && target.isActive &&
    ((data.role && data.role !== ROLES.ADMIN) || data.isActive === false);
  if (losesAdmin) {
    const activeAdmins = await prisma.crmUser.count({ where: { role: ROLES.ADMIN, isActive: true } });
    if (activeAdmins <= 1) throw new HttpError(400, "At least one active Super Admin is required.");
  }

  const update = {};
  if (data.role) update.role = data.role;
  if (data.isActive !== undefined && data.isActive !== null) update.isActive = data.isActive;
  if (data.password) update.password = await bcrypt.hash(data.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.crmUser.update({ where: { id: target.id }, data: update });
    // A deactivated user's leads go back to the unassigned pool.
    if (update.isActive === false) await tx.lead.updateMany({ where: { assignedTo: u.id }, data: { assignedTo: null } });
    return u;
  });
  res.json({ user: publicUser(user) });
};
