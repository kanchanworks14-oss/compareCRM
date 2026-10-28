// backend/controllers/crm/reportsController.js
//
// Handlers for backend/routes/crm/reportsRoutes.js — dashboard metrics and
// reports. Everything is computed from the database within the caller's
// lead scope, so a sales rep's numbers only cover their own leads.
import { Prisma } from "@prisma/client";
import prisma from "../../config/prisma.js";
import { leadScope, ROLES } from "../../middleware/auth.js";
import { buildLeadWhere, loadFollowUps, STAGES } from "./leadsController.js";

const REPORT_TZ = process.env.REPORT_TIMEZONE || "Asia/Kolkata";
const TYPES = ["customer", "developer", "broker", "builder"];

const zeroed = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));

export const summary = async (req, res) => {
  const user = req.user;
  const where = await buildLeadWhere(user, { from: req.query.from, to: req.query.to });
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);

  const [total, byType, byStage, bySource, unassigned, upcomingVisits] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ["leadType"], where, _count: true }),
    prisma.lead.groupBy({ by: ["stage"], where, _count: true }),
    prisma.lead.groupBy({ by: ["source"], where, _count: true, orderBy: { _count: { source: "desc" } }, take: 20 }),
    user.role === ROLES.REP ? 0 : prisma.lead.count({ where: { AND: [where, { assignedTo: null }] } }),
    prisma.siteVisit.count({
      where: { status: "scheduled", scheduledAt: { gte: new Date() }, ...(user.role === ROLES.REP ? { lead: { assignedTo: user.id } } : {}) },
    }),
  ]);

  const typeStage = await prisma.lead.groupBy({ by: ["leadType", "stage"], where, _count: true });
  const categories = Object.fromEntries(TYPES.map((t) => [t, { total: 0, converted: 0 }]));
  for (const r of typeStage) {
    categories[r.leadType].total += r._count;
    if (r.stage === "converted") categories[r.leadType].converted += r._count;
  }

  // Daily lead counts by category, in the business's timezone.
  const scope = user.role === ROLES.REP ? Prisma.sql`AND assigned_to = ${user.id}` : Prisma.empty;
  const daily = await prisma.$queryRaw`
    SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE ${REPORT_TZ}), 'YYYY-MM-DD') AS day,
           lead_type::text AS type, count(*)::int AS count
    FROM leads
    WHERE created_at >= now() - make_interval(days => ${days}) ${scope}
    GROUP BY 1, 2 ORDER BY 1`;

  const followUps = await loadFollowUps(user, { status: "pending" });
  const now = new Date();
  const dayInTz = (d) => d.toLocaleDateString("en-CA", { timeZone: REPORT_TZ }); // YYYY-MM-DD
  const today = dayInTz(now);

  let byAssignee = null;
  if (user.role !== ROLES.REP) {
    const rows = await prisma.lead.groupBy({ by: ["assignedTo", "stage"], where, _count: true });
    const users = await prisma.crmUser.findMany({ select: { id: true, email: true, role: true, isActive: true } });
    const map = new Map();
    for (const r of rows) {
      const key = r.assignedTo ?? "unassigned";
      const entry = map.get(key) ?? { user: users.find((u) => u.id === r.assignedTo) ?? null, total: 0, byStage: zeroed(STAGES) };
      entry.total += r._count;
      entry.byStage[r.stage] = r._count;
      map.set(key, entry);
    }
    byAssignee = [...map.values()].sort((a, b) => b.total - a.total);
  }

  const converted = byStage.find((r) => r.stage === "converted")?._count ?? 0;
  res.json({
    scope: user.role === ROLES.REP ? "assigned" : "all",
    total,
    byType: { ...zeroed(TYPES), ...Object.fromEntries(byType.map((r) => [r.leadType, r._count])) },
    byStage: { ...zeroed(STAGES), ...Object.fromEntries(byStage.map((r) => [r.stage, r._count])) },
    bySource: bySource.map((r) => ({ source: r.source, count: r._count })),
    categories,
    conversionRate: total ? Math.round((converted / total) * 1000) / 10 : 0,
    unassigned,
    upcomingVisits,
    followUps: {
      pending: followUps.length,
      overdue: followUps.filter((f) => new Date(f.dueAt) < now).length,
      dueToday: followUps.filter((f) => new Date(f.dueAt) >= now && dayInTz(new Date(f.dueAt)) === today).length,
    },
    daily: { days, timezone: REPORT_TZ, rows: daily },
    byAssignee,
    totalAllTime: user.role === ROLES.REP ? undefined : await prisma.lead.count({ where: leadScope(user) }),
  });
};
