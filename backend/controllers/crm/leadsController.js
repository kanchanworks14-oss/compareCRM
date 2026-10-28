// backend/controllers/crm/leadsController.js
//
// Handlers for backend/routes/crm/leadsRoutes.js — viewing/updating Lead
// records. Every query goes through leadScope(), so a sales rep can only
// ever read or change leads assigned to them.
//
// Follow-ups and developer/broker submission review have no columns in the
// schema yet, so they live under CRM-owned keys in Lead.metadata
// (`crmFollowUps`, `crmReview`). Website-written metadata keys are never
// touched.
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { validate, HttpError, isUuid } from "../../utils/validate.js";
import { leadScope, ROLES } from "../../middleware/auth.js";
import { reference } from "./publicLeadsController.js";

export const STAGES = ["new", "contacted", "qualified", "converted", "rejected"];
const SUBMISSION_TYPES = ["developer", "broker", "builder"];
const TYPE_GROUPS = { customer: ["customer"], developer: ["developer", "builder"], broker: ["broker"], builder: ["builder"], submissions: SUBMISSION_TYPES };
const REVIEW_STATUSES = ["pending", "approved", "rejected"];

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const metaOf = (lead) => (isObj(lead.metadata) ? lead.metadata : {});

const leadSelect = {
  id: true, leadType: true, name: true, email: true, phone: true, source: true,
  propertyId: true, propertyTitle: true, contactConsent: true, stage: true,
  assignedTo: true, metadata: true, pageUrl: true, createdAt: true, updatedAt: true,
  assignee: { select: { id: true, email: true, role: true } },
};

export const serializeLead = (lead) => {
  const meta = metaOf(lead);
  const followUps = Array.isArray(meta.crmFollowUps) ? meta.crmFollowUps : [];
  return {
    ...lead,
    reference: reference(lead.id),
    review: SUBMISSION_TYPES.includes(lead.leadType) ? (isObj(meta.crmReview) ? meta.crmReview : { status: "pending" }) : null,
    followUps,
    pendingFollowUps: followUps.filter((f) => !f.doneAt).length,
  };
};

// Shared by list, export and reports so filters behave identically everywhere.
export const buildLeadWhere = async (user, q = {}) => {
  const and = [leadScope(user)];
  if (q.type && q.type !== "all") {
    const group = TYPE_GROUPS[q.type];
    if (!group) throw new HttpError(400, "Unknown lead category.");
    and.push({ leadType: { in: group } });
  }
  if (q.stage && q.stage !== "all") {
    if (!STAGES.includes(q.stage)) throw new HttpError(400, "Unknown lead status.");
    and.push({ stage: q.stage });
  }
  if (q.source && q.source !== "all") and.push({ source: String(q.source).slice(0, 100) });
  if (q.assignedTo && user.role !== ROLES.REP) {
    if (q.assignedTo === "unassigned") and.push({ assignedTo: null });
    else if (q.assignedTo === "me") and.push({ assignedTo: user.id });
    else if (isUuid(q.assignedTo)) and.push({ assignedTo: q.assignedTo });
    else throw new HttpError(400, "Invalid assignee filter.");
  }
  if (q.q) {
    const s = String(q.q).trim().slice(0, 100);
    if (s) {
      const contains = { contains: s, mode: "insensitive" };
      const or = [{ name: contains }, { email: contains }, { phone: { contains: s } }, { propertyTitle: contains }];
      if (/^[0-9a-f]{4,8}$/i.test(s)) or.push({ id: { startsWith: s.toLowerCase() } });
      and.push({ OR: or });
    }
  }
  for (const [key, op] of [["from", "gte"], ["to", "lte"]]) {
    if (!q[key]) continue;
    const d = new Date(q[key]);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, `Invalid ${key} date.`);
    if (key === "to" && /^\d{4}-\d{2}-\d{2}$/.test(q[key])) d.setUTCHours(23, 59, 59, 999);
    and.push({ createdAt: { [op]: d } });
  }
  if (q.review && q.review !== "all") {
    if (!REVIEW_STATUSES.includes(q.review)) throw new HttpError(400, "Unknown review status.");
    // Unreviewed submissions have no crmReview key and count as "pending".
    // Prisma's JSON path filters treat a missing key as NULL (so NOT(...)
    // drops them), hence the explicit COALESCE.
    const rows = await prisma.$queryRaw`
      SELECT id FROM leads
      WHERE lead_type::text IN (${Prisma.join(SUBMISSION_TYPES)})
        AND COALESCE(metadata #>> '{crmReview,status}', 'pending') = ${q.review}`;
    and.push({ id: { in: rows.map((r) => r.id) } });
  }
  return { AND: and };
};

const findScopedLead = async (user, id, db = prisma) => {
  if (!isUuid(id)) throw new HttpError(404, "Lead not found.");
  const lead = await db.lead.findFirst({ where: { id, ...leadScope(user) }, select: leadSelect });
  if (!lead) throw new HttpError(404, "Lead not found.");
  return lead;
};

export const listLeads = async (req, res) => {
  const where = await buildLeadWhere(req.user, req.query);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 25, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [total, items] = await prisma.$transaction([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, select: leadSelect, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  res.json({ items: items.map(serializeLead), total, page, pageSize });
};

export const listSources = async (req, res) => {
  const rows = await prisma.lead.groupBy({ by: ["source"], where: leadScope(req.user), _count: true, orderBy: { source: "asc" } });
  res.json({ sources: rows.map((r) => ({ source: r.source, count: r._count })) });
};

export const getLead = async (req, res) => {
  const lead = await findScopedLead(req.user, req.params.id);
  const [activities, siteVisits, extra] = await Promise.all([
    prisma.leadActivity.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { crmUser: { select: { email: true } } },
    }),
    prisma.siteVisit.findMany({
      where: { leadId: lead.id },
      orderBy: { scheduledAt: "asc" },
      include: { crmUser: { select: { id: true, email: true } } },
    }),
    // Request fingerprint is only shown to admins.
    req.user.role === ROLES.ADMIN
      ? prisma.lead.findUnique({ where: { id: lead.id }, select: { ipAddress: true, userAgent: true } })
      : null,
  ]);
  res.json({ lead: { ...serializeLead(lead), ...(extra ?? {}) }, activities, siteVisits });
};

export const updateLead = async (req, res) => {
  const data = validate(req.body, {
    stage: { type: "enum", values: STAGES, optionalKey: true },
    assignedTo: { type: "uuid", optionalKey: true }, // null/"" = unassign
  });
  if ("assignedTo" in data && req.user.role === ROLES.REP) throw new HttpError(403, "Only managers and admins can assign leads.");
  if (!("stage" in data) && !("assignedTo" in data)) throw new HttpError(400, "Nothing to update.");
  if ("stage" in data && !data.stage) throw new HttpError(400, "Please correct the highlighted fields.", { stage: "Status is required." });

  const updated = await prisma.$transaction(async (tx) => {
    const lead = await findScopedLead(req.user, req.params.id, tx);
    const update = {};
    const activities = [];

    if (data.stage && data.stage !== lead.stage) {
      update.stage = data.stage;
      activities.push({ activityType: "stage_change", notes: `${lead.stage} → ${data.stage}` });
    }
    if ("assignedTo" in data && data.assignedTo !== lead.assignedTo) {
      let label = "Unassigned";
      if (data.assignedTo) {
        const assignee = await tx.crmUser.findUnique({ where: { id: data.assignedTo } });
        if (!assignee || !assignee.isActive) throw new HttpError(400, "Please correct the highlighted fields.", { assignedTo: "Choose an active team member." });
        label = assignee.email;
      }
      update.assignedTo = data.assignedTo;
      activities.push({ activityType: "assignment", notes: `Assigned to ${label}` });
    }
    if (!activities.length) return lead;

    const result = await tx.lead.update({ where: { id: lead.id }, data: update, select: leadSelect });
    await tx.leadActivity.createMany({ data: activities.map((a) => ({ ...a, leadId: lead.id, crmUserId: req.user.id })) });
    return result;
  });
  res.json({ lead: serializeLead(updated) });
};

// Read-modify-write of CRM-owned metadata keys, row-locked so two people
// adding follow-ups at the same moment can't overwrite each other.
const mutateMetadata = (user, leadId, mutate, activity) =>
  prisma.$transaction(async (tx) => {
    const lead = await findScopedLead(user, leadId, tx);
    await tx.$queryRaw`SELECT id FROM leads WHERE id = ${lead.id} FOR UPDATE`;
    const { metadata } = await tx.lead.findUnique({ where: { id: lead.id }, select: { metadata: true } });
    const meta = isObj(metadata) ? { ...metadata } : {};
    const result = mutate(meta, lead);
    await tx.lead.update({ where: { id: lead.id }, data: { metadata: meta } });
    await tx.leadActivity.create({ data: { leadId: lead.id, crmUserId: user.id, ...activity(result) } });
    return result;
  });

export const addFollowUp = async (req, res) => {
  const d = validate(req.body, {
    dueAt: { type: "date", required: true },
    note: { type: "text", required: true, max: 500 },
  });
  const followUp = await mutateMetadata(
    req.user,
    req.params.id,
    (meta) => {
      const f = {
        id: crypto.randomUUID(),
        dueAt: d.dueAt.toISOString(),
        note: d.note,
        createdById: req.user.id,
        createdBy: req.user.email,
        createdAt: new Date().toISOString(),
        doneAt: null,
        doneBy: null,
      };
      meta.crmFollowUps = [...(Array.isArray(meta.crmFollowUps) ? meta.crmFollowUps : []), f];
      return f;
    },
    (f) => ({ activityType: "follow_up_scheduled", notes: `Due ${f.dueAt}: ${f.note}` }),
  );
  res.status(201).json({ followUp });
};

export const updateFollowUp = async (req, res) => {
  const d = validate(req.body, { done: { type: "bool", required: true } });
  const followUp = await mutateMetadata(
    req.user,
    req.params.id,
    (meta) => {
      const list = Array.isArray(meta.crmFollowUps) ? meta.crmFollowUps : [];
      const f = list.find((x) => x.id === req.params.followUpId);
      if (!f) throw new HttpError(404, "Follow-up not found.");
      f.doneAt = d.done ? new Date().toISOString() : null;
      f.doneBy = d.done ? req.user.email : null;
      meta.crmFollowUps = list;
      return f;
    },
    (f) => ({ activityType: f.doneAt ? "follow_up_completed" : "follow_up_reopened", notes: f.note }),
  );
  res.json({ followUp });
};

// Every follow-up across the user's scoped leads, flattened and sorted by due date.
export const loadFollowUps = async (user, { status = "pending" } = {}) => {
  const scope = user.role === ROLES.REP ? Prisma.sql`AND assigned_to = ${user.id}` : Prisma.empty;
  const rows = await prisma.$queryRaw`
    SELECT id FROM leads WHERE jsonb_typeof(metadata->'crmFollowUps') = 'array' ${scope}`;
  if (!rows.length) return [];
  const leads = await prisma.lead.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: leadSelect });
  const out = [];
  for (const lead of leads) {
    for (const f of serializeLead(lead).followUps) {
      if (status === "pending" && f.doneAt) continue;
      if (status === "done" && !f.doneAt) continue;
      out.push({
        ...f,
        lead: { id: lead.id, reference: reference(lead.id), name: lead.name, phone: lead.phone, leadType: lead.leadType, propertyTitle: lead.propertyTitle, stage: lead.stage, assignee: lead.assignee },
      });
    }
  }
  return out.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
};

export const listFollowUps = async (req, res) => {
  const status = ["pending", "done", "all"].includes(req.query.status) ? req.query.status : "pending";
  res.json({ followUps: await loadFollowUps(req.user, { status }) });
};

export const reviewSubmission = async (req, res) => {
  const d = validate(req.body, {
    status: { type: "enum", values: REVIEW_STATUSES, required: true },
    note: { type: "text", max: 1000 },
  });
  const review = await mutateMetadata(
    req.user,
    req.params.id,
    (meta, lead) => {
      if (!SUBMISSION_TYPES.includes(lead.leadType)) throw new HttpError(400, "Only developer and agent/broker submissions can be reviewed.");
      meta.crmReview = { status: d.status, note: d.note, reviewedById: req.user.id, reviewedBy: req.user.email, reviewedAt: new Date().toISOString() };
      return meta.crmReview;
    },
    (r) => ({ activityType: "submission_review", notes: `Review: ${r.status}${r.note ? ` — ${r.note}` : ""}` }),
  );
  res.json({ review });
};

const csvCell = (v) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

export const exportLeads = async (req, res) => {
  const leads = await prisma.lead.findMany({
    where: await buildLeadWhere(req.user, req.query),
    select: leadSelect,
    orderBy: { createdAt: "desc" },
    take: 10000,
  });
  const header = ["Reference", "Lead ID", "Name", "Email", "Phone", "Category", "Status", "Source", "Property / project", "Location", "Budget / price", "Company / agency", "Assigned to", "Review", "Pending follow-ups", "Consent", "Created"];
  const lines = leads.map(serializeLead).map((l) => {
    const m = metaOf(l);
    return [
      l.reference, l.id, l.name, l.email, l.phone, l.leadType, l.stage, l.source, l.propertyTitle,
      m.location ?? m.projectLocation, m.budget ?? m.expectedPrice, m.companyName ?? m.agencyName,
      l.assignee?.email ?? "Unassigned", l.review?.status ?? "", l.pendingFollowUps, l.contactConsent ? "yes" : "no",
      l.createdAt.toISOString(),
    ].map(csvCell).join(",");
  });
  const stamp = new Date().toISOString().slice(0, 10);
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="crm-leads-${stamp}.csv"`);
  res.set("Cache-Control", "no-store");
  res.send("﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n"));
};
