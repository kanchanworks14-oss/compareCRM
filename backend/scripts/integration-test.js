// scripts/integration-test.js — end-to-end API test against a running server.
//
// WRITES TO THE DATABASE. It only runs when CRM_TEST_WRITES_DATABASE equals
// the connected database's name, so it can't hit production by accident:
//
//   CRM_TEST_WRITES_DATABASE=<dev db name> npm run test:integration
//
// Every user/lead it creates uses an @crm-test.invalid email and is deleted
// at the end (pass or fail). Start the server with PUBLIC_FORM_RATE_LIMIT=12
// so the form tests fit inside the rate-limit window.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";

const BASE = process.env.CRM_API_BASE || `http://localhost:${process.env.PORT || 4000}/api/crm`;
const RUN = crypto.randomBytes(3).toString("hex");
const TEST_DOMAIN = "crm-test.invalid";
const mail = (who) => `itest-${RUN}-${who}@${TEST_DOMAIN}`;
const pw = () => `T${crypto.randomBytes(9).toString("base64url")}9`;

let passed = 0;
const failures = [];
const check = (name, cond, extra = "") => {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failures.push(name); console.log(`  ❌ ${name} ${extra}`); }
};
const section = (s) => console.log(`\n${s}`);

// Minimal cookie-jar client per signed-in user.
const client = () => {
  let cookie = "";
  const call = async (method, path, body, { csrf = true, raw = false } = {}) => {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (csrf) headers["X-CRM-Request"] = "1";
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  };
  return { call, get cookie() { return cookie; }, set cookie(v) { cookie = v; } };
};

const created = { users: [] };

const main = async () => {
  const [{ db }] = await prisma.$queryRaw`SELECT current_database() AS db`;
  if (process.env.CRM_TEST_WRITES_DATABASE !== db) {
    console.error(`Refusing to write: set CRM_TEST_WRITES_DATABASE=${db} only if "${db}" is a dev/test database.`);
    process.exitCode = 2;
    return;
  }
  console.log(`Integration test run ${RUN} against database "${db}" via ${BASE}`);

  section("1. Health");
  const anon = client();
  const health = await anon.call("GET", "/health");
  check("GET /health reports DB connected", health.status === 200 && health.json?.db === "connected");

  // Test users are inserted directly — the API intentionally has no public sign-up.
  const creds = {};
  for (const role of ["admin", "sales_manager", "sales_rep", "sales_rep2"]) {
    const password = pw();
    const u = await prisma.crmUser.create({
      data: { email: mail(role), role: role === "sales_rep2" ? "sales_rep" : role, password: await bcrypt.hash(password, 12) },
    });
    created.users.push(u.id);
    creds[role] = { email: u.email, password, id: u.id };
  }

  section("2. Authentication");
  const admin = client(), manager = client(), rep = client(), rep2 = client();
  let r = await anon.call("POST", "/auth/login", { email: creds.admin.email, password: "wrong-password-1" });
  check("wrong password → 401", r.status === 401);
  r = await anon.call("POST", "/auth/login", { email: mail("nobody"), password: "whatever123" });
  check("unknown email → 401 (same message)", r.status === 401 && r.json?.error === "Incorrect email or password.");
  r = await anon.call("POST", "/auth/login", { email: creds.admin.email, password: creds.admin.password }, { csrf: false });
  check("login without X-CRM-Request header → 403", r.status === 403);

  r = await admin.call("POST", "/auth/login", creds.admin);
  const setCookie = r.headers.getSetCookie().join(";");
  check("admin login → 200", r.status === 200 && r.json?.user?.role === "admin");
  check("session cookie is HttpOnly + SameSite=Strict", /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie));
  check("login response never includes password hash", !JSON.stringify(r.json).includes("$2"));
  check("manager login → 200", (await manager.call("POST", "/auth/login", creds.sales_manager)).json?.user?.role === "sales_manager");
  check("rep login → 200", (await rep.call("POST", "/auth/login", creds.sales_rep)).json?.user?.role === "sales_rep");
  await rep2.call("POST", "/auth/login", creds.sales_rep2);
  r = await rep.call("GET", "/auth/me");
  check("GET /auth/me returns the signed-in rep", r.status === 200 && r.json?.user?.id === creds.sales_rep.id);
  check("no cookie → 401 on protected route", (await anon.call("GET", "/leads")).status === 401);
  const forged = client();
  forged.cookie = "crm_session=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.";
  check("forged/unsigned token → 401", (await forged.call("GET", "/leads")).status === 401);
  check("state-changing request without CSRF header → 403", (await admin.call("PATCH", "/sales-team/" + creds.sales_rep.id, { isActive: true }, { csrf: false })).status === 403);

  section("3. Public forms → database");
  const formLead = (who, extra) => ({ name: `ITest ${who}`, email: mail(who), phone: "+91 98765 43210", contactConsent: true, pageUrl: "https://example.com/test", ...extra });
  const customerBody = formLead("customer", { location: "Andheri, Mumbai", budget: "₹1 – 2 crore", propertyType: "Apartment", propertyTitle: "ITest Residency", message: "3 BHK please" });
  r = await anon.call("POST", "/public/customer", customerBody, { csrf: false });
  check("customer form → 201 with reference", r.status === 201 && r.json?.id && r.json?.reference);
  const customerId = r.json?.id;
  const customerRow = customerId && await prisma.lead.findUnique({ where: { id: customerId } });
  check("customer row persisted with leadType=customer, source=crm_customer_form",
    customerRow?.leadType === "customer" && customerRow?.source === "crm_customer_form" && customerRow?.metadata?.budget === "₹1 – 2 crore" && customerRow?.propertyTitle === "ITest Residency");

  r = await anon.call("POST", "/public/developer", formLead("developer", { companyName: "ITest Builders", projectName: "ITest Towers", projectLocation: "Thane", projectType: "Residential", totalUnits: 240, reraNumber: "P51700000001" }), { csrf: false });
  const developerId = r.json?.id;
  const devRow = developerId && await prisma.lead.findUnique({ where: { id: developerId } });
  check("developer form → 201, row has leadType=developer, propertyTitle=project", r.status === 201 && devRow?.leadType === "developer" && devRow?.propertyTitle === "ITest Towers" && devRow?.metadata?.totalUnits === 240);

  r = await anon.call("POST", "/public/broker", formLead("broker", { agencyName: "ITest Realty", propertyTitle: "ITest Office", propertyType: "Commercial", listingType: "Rent / Lease", location: "BKC", expectedPrice: "₹3 lakh/month" }), { csrf: false });
  const brokerId = r.json?.id;
  const brokerRow = brokerId && await prisma.lead.findUnique({ where: { id: brokerId } });
  check("broker form → 201, row has leadType=broker", r.status === 201 && brokerRow?.leadType === "broker" && brokerRow?.metadata?.agencyName === "ITest Realty");

  r = await anon.call("POST", "/public/customer", customerBody, { csrf: false });
  const dupCount = await prisma.lead.count({ where: { email: mail("customer") } });
  check("identical resubmission → duplicate, no new row", r.status === 200 && r.json?.duplicate === true && dupCount === 1);

  r = await anon.call("POST", "/public/customer", { ...customerBody, email: "not-an-email", phone: "12", contactConsent: false }, { csrf: false });
  check("invalid fields → 400 with per-field errors", r.status === 400 && r.json?.details?.email && r.json?.details?.phone);
  r = await anon.call("POST", "/public/customer", { ...customerBody, email: mail("noconsent"), contactConsent: false }, { csrf: false });
  check("no consent → 400, nothing stored", r.status === 400 && (await prisma.lead.count({ where: { email: mail("noconsent") } })) === 0);
  r = await anon.call("POST", "/public/developer", formLead("dev-missing", { projectName: "X" }), { csrf: false });
  check("developer missing required fields → 400", r.status === 400 && r.json?.details?.companyName && r.json?.details?.projectType);
  r = await anon.call("POST", "/public/customer", { ...customerBody, email: mail("bot"), website: "http://spam" }, { csrf: false });
  check("honeypot filled → fake success, nothing stored", r.status === 201 && (await prisma.lead.count({ where: { email: mail("bot") } })) === 0);
  r = await anon.call("POST", "/public/customer", "{bad json", { csrf: false });
  check("malformed JSON → 400", r.status === 400);
  const customer2 = await anon.call("POST", "/public/customer", formLead("customer2", { location: "=HYPERLINK(\"x\")", propertyTitle: "=cmd|' /C calc'!A0" }), { csrf: false });
  const customer2Id = customer2.json?.id;

  section("4. Role permissions + lead management");
  r = await rep.call("GET", `/leads?q=${RUN}`);
  check("rep sees 0 leads before assignment", r.status === 200 && r.json.total === 0);
  check("rep cannot open an unassigned lead (404)", (await rep.call("GET", `/leads/${customerId}`)).status === 404);
  r = await manager.call("GET", `/leads?q=${RUN}`);
  check("manager sees all test leads", r.status === 200 && r.json.total === 4);

  r = await manager.call("PATCH", `/leads/${customerId}`, { assignedTo: creds.sales_rep.id });
  check("manager assigns lead to rep", r.status === 200 && r.json?.lead?.assignee?.id === creds.sales_rep.id);
  r = await rep.call("GET", `/leads?q=${RUN}`);
  check("rep now sees exactly their 1 assigned lead", r.json?.total === 1 && r.json.items[0].id === customerId);
  check("other rep still sees 0", (await rep2.call("GET", `/leads?q=${RUN}`)).json?.total === 0);
  r = await rep.call("PATCH", `/leads/${customerId}`, { stage: "contacted" });
  check("rep updates stage on own lead", r.status === 200 && r.json?.lead?.stage === "contacted");
  check("rep cannot reassign (403)", (await rep.call("PATCH", `/leads/${customerId}`, { assignedTo: creds.sales_rep2.id })).status === 403);
  check("rep cannot update someone else's lead (404)", (await rep.call("PATCH", `/leads/${developerId}`, { stage: "contacted" })).status === 404);
  check("invalid stage → 400", (await manager.call("PATCH", `/leads/${customerId}`, { stage: "won" })).status === 400);
  check("assign to non-existent user → 400", (await manager.call("PATCH", `/leads/${brokerId}`, { assignedTo: crypto.randomUUID() })).status === 400);

  r = await manager.call("GET", `/leads?q=${RUN}&type=developer`);
  check("filter type=developer", r.json?.total === 1 && r.json.items[0].id === developerId);
  r = await manager.call("GET", `/leads?q=${RUN}&type=broker`);
  check("filter type=broker", r.json?.total === 1 && r.json.items[0].id === brokerId);
  r = await manager.call("GET", `/leads?q=${RUN}&type=customer&stage=contacted`);
  check("filter type+stage", r.json?.total === 1 && r.json.items[0].id === customerId);
  r = await manager.call("GET", `/leads?q=${encodeURIComponent(mail("broker"))}`);
  check("search by email", r.json?.total === 1);
  r = await manager.call("GET", `/leads?q=${RUN}&assignedTo=unassigned`);
  check("filter unassigned", r.json?.total === 3);
  check("bad filter value → 400", (await manager.call("GET", "/leads?type=alien")).status === 400);

  section("5. Follow-ups, activities, site visits");
  const due = new Date(Date.now() + 3600 * 1000).toISOString();
  r = await rep.call("POST", `/leads/${customerId}/follow-ups`, { dueAt: due, note: "Call back about 3 BHK" });
  const followUpId = r.json?.followUp?.id;
  check("rep schedules follow-up on own lead", r.status === 201 && followUpId);
  check("rep cannot add follow-up to unassigned lead", (await rep.call("POST", `/leads/${brokerId}/follow-ups`, { dueAt: due, note: "x" })).status === 404);
  r = await rep.call("GET", "/leads/follow-ups");
  check("follow-up appears in rep queue", r.json?.followUps?.some((f) => f.id === followUpId));
  check("follow-up visible to manager", (await manager.call("GET", "/leads/follow-ups")).json?.followUps?.some((f) => f.id === followUpId));
  check("follow-up not visible to other rep", !(await rep2.call("GET", "/leads/follow-ups")).json?.followUps?.some((f) => f.id === followUpId));
  r = await rep.call("PATCH", `/leads/${customerId}/follow-ups/${followUpId}`, { done: true });
  check("rep completes follow-up", r.status === 200 && r.json?.followUp?.doneAt);
  check("completed follow-up leaves pending queue", !(await rep.call("GET", "/leads/follow-ups")).json?.followUps?.some((f) => f.id === followUpId));
  const metaAfter = (await prisma.lead.findUnique({ where: { id: customerId } })).metadata;
  check("website/form metadata preserved alongside CRM keys", metaAfter.budget === "₹1 – 2 crore" && metaAfter.form === "customer" && Array.isArray(metaAfter.crmFollowUps));

  r = await rep.call("POST", "/activities", { leadId: customerId, activityType: "call", notes: "Discussed budget" });
  check("rep logs a call activity", r.status === 201);
  check("rep cannot log activity on others' lead", (await rep.call("POST", "/activities", { leadId: brokerId, activityType: "note", notes: "x" })).status === 404);
  r = await rep.call("GET", `/leads/${customerId}`);
  const types = (r.json?.activities ?? []).map((a) => a.activityType);
  check("lead detail has full audit trail", ["assignment", "stage_change", "follow_up_scheduled", "follow_up_completed", "call"].every((t) => types.includes(t)), JSON.stringify(types));
  check("non-admin detail hides IP/user agent", r.json?.lead && !("ipAddress" in r.json.lead));
  check("admin detail includes IP", "ipAddress" in ((await admin.call("GET", `/leads/${customerId}`)).json?.lead ?? {}));

  const visitAt = new Date(Date.now() + 2 * 86400 * 1000).toISOString();
  r = await rep.call("POST", "/site-visits", { leadId: customerId, scheduledAt: visitAt, notes: "Meet at gate" });
  const visitId = r.json?.visit?.id;
  check("rep schedules site visit on own lead", r.status === 201 && r.json?.visit?.crmUser?.id === creds.sales_rep.id);
  check("rep cannot schedule visit on others' lead", (await rep.call("POST", "/site-visits", { leadId: brokerId, scheduledAt: visitAt })).status === 404);
  check("other rep cannot see the visit", !(await rep2.call("GET", "/site-visits")).json?.visits?.some((v) => v.id === visitId));
  r = await rep.call("PATCH", `/site-visits/${visitId}`, { status: "completed" });
  check("rep marks visit completed", r.status === 200 && r.json?.visit?.status === "completed");
  check("other rep cannot update it (404)", (await rep2.call("PATCH", `/site-visits/${visitId}`, { status: "cancelled" })).status === 404);
  r = await manager.call("POST", "/site-visits", { leadId: brokerId, scheduledAt: visitAt, crmUserId: creds.sales_rep2.id });
  check("manager schedules visit for another rep", r.status === 201 && r.json?.visit?.crmUser?.id === creds.sales_rep2.id);
  const visitRow = await prisma.siteVisit.findUnique({ where: { id: visitId } });
  check("site visit persisted in site_visits", visitRow?.status === "completed" && visitRow?.leadId === customerId);

  section("6. Submission review");
  r = await manager.call("POST", `/leads/${developerId}/review`, { status: "approved", note: "RERA verified" });
  check("manager approves developer submission", r.status === 200 && r.json?.review?.status === "approved");
  check("review of a customer lead → 400", (await manager.call("POST", `/leads/${customerId}/review`, { status: "approved" })).status === 400);
  check("rep cannot review (403)", (await rep.call("POST", `/leads/${brokerId}/review`, { status: "approved" })).status === 403);
  r = await manager.call("GET", `/leads?q=${RUN}&review=approved`);
  check("filter review=approved", r.json?.total === 1 && r.json.items[0].id === developerId);
  r = await manager.call("GET", `/leads?q=${RUN}&review=pending`);
  check("filter review=pending includes never-reviewed broker", r.json?.items?.some((l) => l.id === brokerId) && !r.json.items.some((l) => l.id === developerId), JSON.stringify(r.json?.items?.map((l) => l.leadType)));

  section("7. Reports + CSV export");
  r = await admin.call("GET", "/reports/summary");
  check("admin summary counts include test leads", r.status === 200 && r.json.total >= 4 && r.json.byType.developer >= 1 && Array.isArray(r.json.byAssignee));
  r = await rep.call("GET", "/reports/summary");
  check("rep summary only covers own leads", r.status === 200 && r.json.total === 1 && r.json.scope === "assigned" && r.json.byAssignee === null);
  r = await manager.call("GET", `/leads/export?q=${RUN}`);
  check("manager CSV export → 200 text/csv", r.status === 200 && /text\/csv/.test(r.headers.get("content-type")));
  check("CSV contains the 4 test leads (+header)", r.text.trim().split("\r\n").length === 5);
  check("CSV neutralises formula injection", r.text.includes(`"'=cmd`) && !r.text.includes(`,"=cmd`));
  check("rep CSV export → 403", (await rep.call("GET", "/leads/export")).status === 403);

  section("8. User management");
  check("rep cannot list team (403)", (await rep.call("GET", "/sales-team")).status === 403);
  check("manager can list team", (await manager.call("GET", "/sales-team")).status === 200);
  check("manager cannot create users (403)", (await manager.call("POST", "/sales-team", { email: mail("x"), role: "sales_rep", password: pw() })).status === 403);
  r = await admin.call("POST", "/sales-team", { email: mail("newrep"), role: "sales_rep", password: "short" });
  check("weak password rejected", r.status === 400 && r.json?.details?.password);
  const newRepPw = pw();
  r = await admin.call("POST", "/sales-team", { email: mail("newrep"), role: "sales_rep", password: newRepPw });
  if (r.json?.user?.id) created.users.push(r.json.user.id);
  check("admin creates a rep", r.status === 201 && r.json?.user?.role === "sales_rep" && !("password" in r.json.user));
  check("duplicate email → 409", (await admin.call("POST", "/sales-team", { email: mail("newrep"), role: "sales_rep", password: newRepPw })).status === 409);
  const newRep = client();
  check("new rep can sign in", (await newRep.call("POST", "/auth/login", { email: mail("newrep"), password: newRepPw })).status === 200);

  r = await admin.call("PATCH", `/sales-team/${creds.sales_rep.id}`, { isActive: false });
  check("admin deactivates rep", r.status === 200 && r.json?.user?.isActive === false);
  check("deactivated rep's existing session is rejected immediately", (await rep.call("GET", "/leads")).status === 401);
  check("deactivated rep's leads return to unassigned pool", (await prisma.lead.findUnique({ where: { id: customerId } })).assignedTo === null);
  check("deactivated rep cannot log in", (await client().call("POST", "/auth/login", creds.sales_rep)).status === 401);

  r = await manager.call("POST", "/auth/password", { currentPassword: creds.sales_manager.password, newPassword: "NewManagerPass123" });
  check("manager changes own password", r.status === 200);
  const otherManagerSession = client();
  otherManagerSession.cookie = manager.cookie; // the refreshed cookie keeps working
  check("current session survives password change", (await manager.call("GET", "/auth/me")).status === 200);
  const oldSession = client();
  await oldSession.call("POST", "/auth/login", { email: creds.sales_manager.email, password: "NewManagerPass123" });
  check("old password no longer works", (await client().call("POST", "/auth/login", creds.sales_manager)).status === 401);

  const activeAdmins = await prisma.crmUser.count({ where: { role: "admin", isActive: true } });
  if (activeAdmins === 1) {
    check("cannot deactivate the last active admin", (await admin.call("PATCH", `/sales-team/${creds.admin.id}`, { isActive: false })).status === 400);
  }

  r = await admin.call("POST", "/auth/logout");
  check("logout clears the session cookie", r.status === 200 && admin.cookie === "");
  check("after logout, protected route → 401", (await admin.call("GET", "/leads")).status === 401);

  section("9. Rate limiting");
  let limited = false;
  for (let i = 0; i < 15 && !limited; i++) {
    const x = await anon.call("POST", "/public/broker", { name: "x" }, { csrf: false });
    limited = x.status === 429;
  }
  check("public form endpoint returns 429 when flooded", limited);

  void customer2Id;
};

const cleanup = async () => {
  const leads = await prisma.lead.findMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } }, select: { id: true } });
  const ids = leads.map((l) => l.id);
  const users = await prisma.crmUser.findMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  await prisma.$transaction([
    prisma.siteVisit.deleteMany({ where: { OR: [{ leadId: { in: ids } }, { crmUserId: { in: userIds } }] } }),
    prisma.leadActivity.deleteMany({ where: { OR: [{ leadId: { in: ids } }, { crmUserId: { in: userIds } }] } }),
    prisma.lead.deleteMany({ where: { id: { in: ids } } }),
    prisma.crmUser.deleteMany({ where: { id: { in: userIds } } }),
  ]);
  console.log(`\nCleanup: removed ${ids.length} test leads and ${userIds.length} test users (only @${TEST_DOMAIN} records).`);
};

main()
  .catch((err) => { failures.push(`crashed: ${err.message}`); console.error(err); })
  .finally(async () => {
    if (process.exitCode !== 2) {
      await cleanup().catch((e) => console.error("Cleanup failed:", e.message));
      console.log(`\nResult: ${passed} passed, ${failures.length} failed`);
      if (failures.length) { console.log("Failed:\n - " + failures.join("\n - ")); process.exitCode = 1; }
    }
    await prisma.$disconnect();
  });
