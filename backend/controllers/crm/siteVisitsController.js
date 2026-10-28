// backend/controllers/crm/siteVisitsController.js
//
// Handlers for backend/routes/crm/siteVisitsRoutes.js — SiteVisit
// records. A sales rep sees and manages visits only for leads assigned to
// them; managers/admins see all and may schedule a visit for any active
// team member. SiteVisit has no notes column, so visit notes are logged as
// a LeadActivity alongside the visit.
import prisma from "../../config/prisma.js";
import { validate, HttpError, isUuid } from "../../utils/validate.js";
import { leadScope, ROLES } from "../../middleware/auth.js";

export const VISIT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"];

const visitInclude = {
  lead: { select: { id: true, name: true, phone: true, leadType: true, propertyTitle: true, stage: true } },
  crmUser: { select: { id: true, email: true } },
};

const visitScope = (user) => (user.role === ROLES.REP ? { lead: { assignedTo: user.id } } : {});

export const listVisits = async (req, res) => {
  const and = [visitScope(req.user)];
  if (req.query.leadId) {
    if (!isUuid(req.query.leadId)) throw new HttpError(400, "Invalid lead id.");
    and.push({ leadId: req.query.leadId });
  }
  if (req.query.status && req.query.status !== "all") {
    if (!VISIT_STATUSES.includes(req.query.status)) throw new HttpError(400, "Unknown visit status.");
    and.push({ status: req.query.status });
  }
  if (req.query.upcoming === "true") and.push({ scheduledAt: { gte: new Date() } });
  const visits = await prisma.siteVisit.findMany({ where: { AND: and }, include: visitInclude, orderBy: { scheduledAt: "asc" }, take: 500 });
  res.json({ visits });
};

export const createVisit = async (req, res) => {
  const d = validate(req.body, {
    leadId: { type: "uuid", required: true },
    scheduledAt: { type: "date", required: true },
    crmUserId: { type: "uuid" },
    notes: { type: "text", max: 1000 },
  });
  const lead = await prisma.lead.findFirst({ where: { id: d.leadId, ...leadScope(req.user) }, select: { id: true, assignedTo: true } });
  if (!lead) throw new HttpError(404, "Lead not found.");

  // Reps always own the visits they schedule; managers can pick anyone active.
  let crmUserId = req.user.id;
  if (req.user.role !== ROLES.REP) crmUserId = d.crmUserId ?? lead.assignedTo ?? req.user.id;
  const owner = await prisma.crmUser.findUnique({ where: { id: crmUserId } });
  if (!owner?.isActive) throw new HttpError(400, "Please correct the highlighted fields.", { crmUserId: "Choose an active team member." });

  const visit = await prisma.$transaction(async (tx) => {
    const v = await tx.siteVisit.create({ data: { leadId: lead.id, crmUserId, scheduledAt: d.scheduledAt }, include: visitInclude });
    await tx.leadActivity.create({
      data: {
        leadId: lead.id,
        crmUserId: req.user.id,
        activityType: "site_visit_scheduled",
        notes: `Visit on ${d.scheduledAt.toISOString()} with ${owner.email}${d.notes ? ` — ${d.notes}` : ""}`,
      },
    });
    return v;
  });
  res.status(201).json({ visit });
};

export const updateVisit = async (req, res) => {
  if (!isUuid(req.params.id)) throw new HttpError(404, "Visit not found.");
  const d = validate(req.body, {
    status: { type: "enum", values: VISIT_STATUSES, optionalKey: true },
    scheduledAt: { type: "date", optionalKey: true },
    notes: { type: "text", max: 1000 },
  });
  if (!d.status && !d.scheduledAt) throw new HttpError(400, "Nothing to update.");
  const existing = await prisma.siteVisit.findFirst({ where: { id: req.params.id, ...visitScope(req.user) } });
  if (!existing) throw new HttpError(404, "Visit not found.");

  const update = {};
  if (d.status) update.status = d.status;
  if (d.scheduledAt) update.scheduledAt = d.scheduledAt;
  const visit = await prisma.$transaction(async (tx) => {
    const v = await tx.siteVisit.update({ where: { id: existing.id }, data: update, include: visitInclude });
    const parts = [];
    if (d.status && d.status !== existing.status) parts.push(`${existing.status} → ${d.status}`);
    if (d.scheduledAt) parts.push(`rescheduled to ${d.scheduledAt.toISOString()}`);
    if (d.notes) parts.push(d.notes);
    await tx.leadActivity.create({
      data: { leadId: existing.leadId, crmUserId: req.user.id, activityType: "site_visit_updated", notes: parts.join(" — ") || null },
    });
    return v;
  });
  res.json({ visit });
};
