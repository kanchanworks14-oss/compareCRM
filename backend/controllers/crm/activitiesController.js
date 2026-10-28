// backend/controllers/crm/activitiesController.js
//
// Handlers for backend/routes/crm/activitiesRoutes.js — LeadActivity
// records. System events (stage changes, assignments, follow-ups, visits)
// are written by the other controllers; this one lets users read the trail
// and log manual contact notes.
import prisma from "../../config/prisma.js";
import { validate, HttpError, isUuid } from "../../utils/validate.js";
import { leadScope } from "../../middleware/auth.js";

export const MANUAL_ACTIVITY_TYPES = ["note", "call", "email", "whatsapp", "meeting"];

const assertLeadVisible = async (user, leadId) => {
  if (!isUuid(leadId)) throw new HttpError(404, "Lead not found.");
  const lead = await prisma.lead.findFirst({ where: { id: leadId, ...leadScope(user) }, select: { id: true } });
  if (!lead) throw new HttpError(404, "Lead not found.");
};

export const listActivities = async (req, res) => {
  await assertLeadVisible(req.user, req.query.leadId);
  const activities = await prisma.leadActivity.findMany({
    where: { leadId: req.query.leadId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { crmUser: { select: { email: true } } },
  });
  res.json({ activities });
};

export const createActivity = async (req, res) => {
  const d = validate(req.body, {
    leadId: { type: "uuid", required: true },
    activityType: { type: "enum", values: MANUAL_ACTIVITY_TYPES, required: true },
    notes: { type: "text", required: true, max: 2000 },
  });
  await assertLeadVisible(req.user, d.leadId);
  const activity = await prisma.leadActivity.create({
    data: { leadId: d.leadId, crmUserId: req.user.id, activityType: d.activityType, notes: d.notes },
    include: { crmUser: { select: { email: true } } },
  });
  res.status(201).json({ activity });
};
