// scripts/db-check.js — read-only database health check.
// Prints counts/aggregates only; never prints names, emails, phones or secrets.
// Usage: node scripts/db-check.js
import prisma from "../config/prisma.js";

const main = async () => {
  const [{ now, db }] = await prisma.$queryRaw`SELECT now() AS now, current_database() AS db`;
  console.log(`Connected ✅  database=${db}  server_time=${now.toISOString()}`);

  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at`;
  console.log("\nApplied migrations:");
  migrations.forEach((m) => console.log(`  ${m.migration_name}  ${m.finished_at ? "applied" : "NOT FINISHED"}`));

  const total = await prisma.lead.count();
  console.log(`\nLeads total: ${total}`);

  const byType = await prisma.lead.groupBy({ by: ["leadType"], _count: true });
  console.log("Leads by type:", Object.fromEntries(byType.map((r) => [r.leadType, r._count])));

  const byStage = await prisma.lead.groupBy({ by: ["stage"], _count: true });
  console.log("Leads by stage:", Object.fromEntries(byStage.map((r) => [r.stage, r._count])));

  const bySource = await prisma.lead.groupBy({ by: ["source"], _count: true });
  console.log("Leads by source:", Object.fromEntries(bySource.map((r) => [r.source, r._count])));

  const range = await prisma.lead.aggregate({ _min: { createdAt: true }, _max: { createdAt: true } });
  console.log(`Oldest lead: ${range._min.createdAt?.toISOString() ?? "-"}  Newest lead: ${range._max.createdAt?.toISOString() ?? "-"}`);

  const assigned = await prisma.lead.count({ where: { assignedTo: { not: null } } });
  console.log(`Assigned leads: ${assigned}`);

  const users = await prisma.crmUser.groupBy({ by: ["role", "isActive"], _count: true });
  console.log("\nCRM users:", users.length ? users.map((u) => `${u.role}${u.isActive ? "" : "(inactive)"}=${u._count}`).join(", ") : "none");

  console.log(`Lead activities: ${await prisma.leadActivity.count()}`);
  console.log(`Site visits: ${await prisma.siteVisit.count()}`);
};

main()
  .catch((err) => {
    // Error messages from the driver can include the host; strip anything URL-like.
    console.error("DB check failed ❌", String(err.message).replace(/postgres(ql)?:\/\/\S+/g, "<redacted-url>"));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
