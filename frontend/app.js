// frontend/app.js — Compare Projects CRM dashboard.
//
// Every number and record on screen comes from the backend API (config.js).
// Nothing is kept in localStorage; the session is an httpOnly cookie set by
// the server, and the server enforces every role rule. The role checks here
// only hide controls a user isn't allowed to use.
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const API = (window.CRM_CONFIG?.apiBase || "http://localhost:4000/api/crm").replace(/\/$/, "");

const ROLE_LABEL = { admin: "Super Admin", sales_manager: "Sales Manager", sales_rep: "Sales Representative" };
const ROLE_SHORT = { admin: "SA", sales_manager: "SM", sales_rep: "SR" };
const STAGES = ["new", "contacted", "qualified", "converted", "rejected"];
const VISIT_STATUSES = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
const ACTIVITY_LABEL = {
  note: "Note", call: "Call", email: "Email", whatsapp: "WhatsApp", meeting: "Meeting",
  stage_change: "Status changed", assignment: "Assignment", follow_up_scheduled: "Follow-up scheduled",
  follow_up_completed: "Follow-up completed", follow_up_reopened: "Follow-up reopened",
  site_visit_scheduled: "Site visit scheduled", site_visit_updated: "Site visit updated", submission_review: "Submission review",
};
const META_LABEL = {
  location: "Preferred location", budget: "Budget", propertyType: "Property type", message: "Message",
  companyName: "Company / developer", projectLocation: "Project location", projectType: "Project type",
  totalUnits: "Total units", reraNumber: "RERA number", possession: "Possession", agencyName: "Agency / brokerage",
  listingType: "Listing type", expectedPrice: "Expected price",
};
const VIEW_TITLES = {
  dashboard: ["Overview", "Overview", "What’s happening with your property leads."],
  leads: ["All Leads", "Lead management", "Search, categorize and assign incoming enquiries."],
  customers: ["Customer Leads", "Customer enquiries", "Property requirements from customers."],
  developers: ["Developer Leads", "Developer leads", "Project owners and developer enquiries."],
  agents: ["Agent / Broker Leads", "Agent & broker leads", "Broker and agent property submissions."],
  followups: ["Follow-ups", "Follow-up queue", "Never miss the next conversation."],
  visits: ["Site Visits", "Site visit planner", "Schedule and track property visits."],
  properties: ["Submission Review", "Submission review", "Review projects and properties submitted by developers and agents."],
  team: ["Sales Team", "Team workspace", "Workload and lead assignment across the sales team."],
  reports: ["Reports & Analytics", "Performance reports", "Lead sources, pipeline and conversion from live data."],
  forms: ["Public Forms", "Public enquiry forms", "The three forms that feed leads into the CRM."],
  settings: ["Account & Settings", "Account & settings", "Your account, password and access level."],
};
const CATEGORY_VIEWS = { customers: "customer", developers: "developer", agents: "broker" };

// `session` changes on every sign-in/sign-out, so a slow response from a
// previous session can't sign out (or render into) the current one.
const state = { me: null, session: 0, view: "dashboard", team: [], leadPage: 1, pageSize: 25 };

const STALE = "stale-session";
class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

async function api(path, { method = "GET", body, raw = false } = {}) {
  const session = state.session;
  let res;
  try {
    res = await fetch(API + path, {
      method,
      credentials: "include",
      headers: { "X-CRM-Request": "1", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, `Cannot reach the CRM server at ${API}. Is the backend running?`);
  }
  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (session !== state.session) throw new ApiError(0, STALE);
  if (res.status === 401 && state.me && path !== "/auth/login") {
    state.me = null;
    state.session++;
    showLogin(data.error || "Please sign in again.");
  }
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status}).`, data.details);
  return data;
}

// ---------- small helpers ----------
const esc = (s = "") => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (n = "?") => n.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "?";
const cap = (s = "") => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const typeLabel = (t) => ({ broker: "Agent / Broker", developer: "Developer", builder: "Builder", customer: "Customer" }[t] || cap(t));
const typeClass = (t) => (t === "broker" ? "agent" : t === "builder" ? "developer" : t);
const badgeType = (t) => `<span class="category-pill cat-${typeClass(t)}">${esc(typeLabel(t))}</span>`;
const badgeStage = (s) => `<span class="status-pill status-${esc(s)}">${esc(cap(s))}</span>`;
const badgeReview = (r) => (r ? `<span class="status-pill review-${esc(r.status)}">${esc(cap(r.status === "pending" ? "pending review" : r.status))}</span>` : "");
const sourceLabel = (s) => ({ crm_customer_form: "CRM customer form", crm_developer_form: "CRM developer form", crm_broker_form: "CRM broker form" }[s] || s || "—");
const dateLabel = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const dateTimeLabel = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const can = (...roles) => !!state.me && roles.includes(state.me.role);
const isManager = () => can("admin", "sales_manager");
const meta = (l) => (l.metadata && typeof l.metadata === "object" && !Array.isArray(l.metadata) ? l.metadata : {});
const interestOf = (l) => l.propertyTitle || meta(l).location || meta(l).projectLocation || "—";
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== "" && v !== undefined && v !== null)).toString();
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function toast(msg, isError = false) {
  if (msg === STALE) return; // response from a previous session; nothing to report
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("error", isError);
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3200);
}
function feedback(id, msg, type) {
  const el = $("#" + id);
  el.textContent = msg;
  el.className = "form-feedback " + type;
}
function clearFieldErrors(form) {
  $$(".field-error", form).forEach((e) => e.remove());
  $$(".invalid", form).forEach((e) => e.classList.remove("invalid"));
}
function showFieldErrors(form, details = {}) {
  for (const [name, msg] of Object.entries(details)) {
    const input = form.elements[name];
    if (!input?.closest) continue;
    input.classList.add("invalid");
    input.insertAdjacentHTML("afterend", `<small class="field-error">${esc(msg)}</small>`);
  }
}
const contactCell = (l) =>
  `<div class="contact-cell"><span class="contact-avatar ${typeClass(l.leadType) === "developer" ? "violet" : typeClass(l.leadType) === "agent" ? "green" : ""}">${esc(initials(l.name))}</span><span><b>${esc(l.name)}</b><small>${esc(l.email)}</small></span></div>`;
const teamOptions = (selected, { includeUnassigned = true, label = "Unassigned" } = {}) =>
  (includeUnassigned ? `<option value="">${label}</option>` : "") +
  state.team.filter((u) => u.isActive || u.id === selected)
    .map((u) => `<option value="${esc(u.id)}" ${u.id === selected ? "selected" : ""}>${esc(u.email)} · ${ROLE_SHORT[u.role]}</option>`).join("");
const stageOptions = (selected) => STAGES.map((s) => `<option value="${s}" ${s === selected ? "selected" : ""}>${cap(s)}</option>`).join("");

// ---------- auth ----------
function showLogin(message) {
  $("#bootScreen").classList.add("hidden");
  $("#appShell").classList.add("hidden");
  $("#leadModal").classList.add("hidden");
  $("#loginScreen").classList.remove("hidden");
  $("#loginBtn").disabled = false;
  if (message) feedback("loginFeedback", message, "error");
  $("#loginForm").elements.email.focus();
}

async function boot() {
  $("#copyright").textContent = `© ${new Date().getFullYear()} Compare Projects CRM`;
  try {
    const { user } = await api("/auth/me");
    state.me = user;
    await startApp();
  } catch (err) {
    showLogin(err.status === 401 ? "" : err.message);
  }
}

async function startApp() {
  const me = state.me;
  const session = state.session;
  $("#loginScreen").classList.add("hidden");
  $("#bootScreen").classList.add("hidden");
  $("#appShell").classList.remove("hidden");
  $("#profileAvatar").textContent = ROLE_SHORT[me.role];
  $("#topAvatar").textContent = initials(me.email);
  $("#profileName").textContent = me.email;
  $("#profileRole").textContent = ROLE_LABEL[me.role];
  $("#todayLabel").textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  $$("[data-roles]").forEach((el) => el.classList.toggle("role-hidden", !el.dataset.roles.split(",").includes(me.role)));
  if (isManager()) await loadTeamCache();
  await loadSources();
  if (session !== state.session) return; // signed out while loading
  go("dashboard");
}

async function loadTeamCache() {
  try {
    state.team = (await api("/sales-team")).users;
    $("#assigneeFilter").innerHTML = `<option value="">Anyone</option><option value="unassigned">Unassigned</option><option value="me">Me</option>` +
      state.team.map((u) => `<option value="${esc(u.id)}">${esc(u.email)}</option>`).join("");
    $("#visitOwner").innerHTML = teamOptions("", { label: "Lead's assignee" });
  } catch (err) { toast(err.message, true); }
}

async function loadSources() {
  try {
    const { sources } = await api("/leads/sources");
    $("#sourceFilter").innerHTML = `<option value="all">All sources</option>` +
      sources.map((s) => `<option value="${esc(s.source)}">${esc(sourceLabel(s.source))} (${s.count})</option>`).join("");
  } catch { /* filter is optional */ }
}

// ---------- navigation ----------
function go(view) {
  const navBtn = $(`#nav [data-view="${view}"]`);
  if (navBtn?.classList.contains("role-hidden")) view = "dashboard";
  state.view = view;
  $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === view));
  $$(".view").forEach((n) => n.classList.add("hidden"));
  const target = CATEGORY_VIEWS[view] ? "leads" : view;
  $("#" + target + "View")?.classList.remove("hidden");
  const t = VIEW_TITLES[view] || VIEW_TITLES.dashboard;
  $("#crumbTitle").textContent = t[0];
  $("#pageTitle").innerHTML = (view === "dashboard" ? `Welcome, ${esc(state.me.email.split("@")[0])}` : esc(t[1])) + " <span>✦</span>";
  $("#pageSubtitle").textContent = t[2];
  if (innerWidth < 900) $("#sidebar").classList.remove("open");

  if (target === "leads") {
    $("#leadFilters").reset();
    $("#typeFilter").value = CATEGORY_VIEWS[view] || "all";
    $("#typeFilter").classList.toggle("hidden", !!CATEGORY_VIEWS[view]);
    state.leadPage = 1;
  }
  refreshView();
}

function refreshView() {
  const v = state.view;
  const run = {
    dashboard: loadDashboard, followups: loadFollowups, visits: loadVisits, properties: loadSubmissions,
    team: loadTeam, reports: loadReports, settings: renderSettings, forms: () => {},
  }[CATEGORY_VIEWS[v] || v === "leads" ? "leads" : v] || loadLeads;
  return Promise.resolve(run()).catch((err) => toast(err.message, true));
}

// ---------- dashboard ----------
async function loadDashboard() {
  const days = Number($("#chartRange").value);
  const [summary, recent, follow] = await Promise.all([
    api(`/reports/summary?days=${days}`),
    api("/leads?pageSize=5"),
    api("/leads/follow-ups?status=pending"),
  ]);
  const s = summary.byStage;
  $("#navCount").textContent = summary.total;
  $("#mTotal").textContent = summary.total;
  $("#mTotalFoot").textContent = summary.scope === "assigned" ? "Leads assigned to you" : "All categories";
  $("#mNew").textContent = s.new;
  $("#mQualified").textContent = s.qualified;
  $("#mConversion").innerHTML = `${summary.conversionRate}<span>%</span>`;
  $("#mConversionBar").style.width = Math.min(summary.conversionRate, 100) + "%";
  $("#pipelineTotal").textContent = summary.total;
  for (const st of STAGES) $("#p" + cap(st)).textContent = s[st];
  const colors = { new: "#4389f5", contacted: "#8b68e8", qualified: "#21b99a", converted: "#f6a544", rejected: "#e06c7c" };
  $("#pipelineLine").innerHTML = summary.total
    ? STAGES.filter((st) => s[st]).map((st) => `<i style="width:${(100 * s[st]) / summary.total}%;background:${colors[st]}" title="${cap(st)}: ${s[st]}"></i>`).join("")
    : `<i style="width:100%;background:#eef2f7"></i>`;
  renderChart(summary.daily.rows, days);

  $("#recentSubtitle").textContent = summary.scope === "assigned" ? "Latest leads assigned to you" : "Latest enquiries from all sources";
  $("#recentRows").innerHTML = recent.items.map((l) =>
    `<tr data-detail="${esc(l.id)}" class="clickable"><td>${contactCell(l)}</td><td>${badgeType(l.leadType)}</td><td>${esc(interestOf(l))}</td><td>${badgeStage(l.stage)}</td><td>${esc(l.assignee?.email || "Unassigned")}</td></tr>`,
  ).join("") || `<tr><td colspan="5" class="empty-state">No leads yet. Submissions from the public forms appear here.</td></tr>`;

  const f = summary.followUps;
  $("#followCount").textContent = f.pending;
  $("#followSummary").textContent = `${f.overdue} overdue · ${f.dueToday} due later today`;
  $("#taskList").innerHTML = follow.followUps.slice(0, 5).map(followUpTask).join("") ||
    `<p class="field-help">No pending follow-ups. Add one from a lead's details.</p>`;
  $("#visitQuick").textContent = `${summary.upcomingVisits} upcoming scheduled visit${summary.upcomingVisits === 1 ? "" : "s"}`;
}

const followUpTask = (f) => {
  const overdue = new Date(f.dueAt) < new Date();
  return `<div class="task"><button class="task-check" data-followup="${esc(f.id)}" data-lead="${esc(f.lead.id)}" data-done="false" title="Mark complete" aria-label="Mark complete"></button><div class="task-main clickable" data-detail="${esc(f.lead.id)}"><b>${esc(f.lead.name)}</b><small>${esc(f.note)}</small></div><span class="task-time ${overdue ? "overdue" : ""}">${overdue ? "Overdue · " : ""}${esc(dateTimeLabel(f.dueAt))}</span></div>`;
};

function renderChart(rows, days) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(d.toLocaleDateString("en-CA"));
  }
  const byDay = Object.fromEntries(keys.map((k) => [k, { customer: 0, developer: 0, broker: 0 }]));
  for (const r of rows) {
    if (!byDay[r.day]) continue;
    byDay[r.day][r.type === "builder" ? "developer" : r.type] += r.count;
  }
  const max = Math.max(4, ...keys.flatMap((k) => Object.values(byDay[k])));
  const top = Math.ceil(max / 4) * 4;
  $("#chartY").innerHTML = [4, 3, 2, 1, 0].map((i) => `<span>${(top * i) / 4}</span>`).join("");
  const labelEvery = days <= 7 ? 1 : days <= 14 ? 2 : 5;
  $("#chartBars").innerHTML = keys.map((k, i) => {
    const d = new Date(k + "T00:00:00");
    const label = days <= 7 ? d.toLocaleDateString("en-IN", { weekday: "short" }) : `${d.getDate()}/${d.getMonth() + 1}`;
    const c = byDay[k];
    const bar = (cls, n, name) => `<i class="bar ${cls}" style="height:${(100 * n) / top}%" title="${name}: ${n} on ${dateLabel(k)}"></i>`;
    return `<div class="chart-group">${bar("customer-bar", c.customer, "Customer")}${bar("developer-bar", c.developer, "Developer")}${bar("agent-bar", c.broker, "Agent / Broker")}<small>${(keys.length - 1 - i) % labelEvery === 0 ? label : ""}</small></div>`;
  }).join("");
}

// ---------- leads ----------
function leadFilters() {
  return {
    q: $("#leadSearch").value.trim(),
    stage: $("#stageFilter").value,
    type: $("#typeFilter").value,
    source: $("#sourceFilter").value,
    assignedTo: isManager() ? $("#assigneeFilter").value : "",
  };
}

async function loadLeads() {
  const f = leadFilters();
  const data = await api(`/leads?${qs({ ...f, page: state.leadPage, pageSize: state.pageSize })}`);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  $("#leadRows").innerHTML = data.items.map(leadRow).join("");
  $("#leadResultCount").textContent = `${data.total} record${data.total === 1 ? "" : "s"}`;
  $("#emptyState").classList.toggle("hidden", data.items.length !== 0);
  $("#emptyState").textContent = data.total === 0 && !f.q && f.stage === "all"
    ? (state.me.role === "sales_rep" ? "No leads are assigned to you yet." : "No leads in this category yet.")
    : "No leads match these filters.";
  $("#pageInfo").textContent = `Page ${data.page} of ${pages}`;
  $("#prevPage").disabled = data.page <= 1;
  $("#nextPage").disabled = data.page >= pages;
  $("#leadListTitle").textContent = f.type === "all" ? "All leads" : `${typeLabel(f.type)} leads`;
  $("#leadListSubtitle").textContent = state.me.role === "sales_rep" ? "Leads assigned to you." : "Manage enquiries, ownership and next steps.";
  if (state.view === "leads" && !f.q && f.stage === "all" && f.type === "all" && f.source === "all" && !f.assignedTo) $("#navCount").textContent = data.total;
}

function leadRow(l) {
  const assignee = isManager()
    ? `<select class="row-assignee" data-id="${esc(l.id)}" aria-label="Assign lead">${teamOptions(l.assignedTo)}</select>`
    : esc(l.assignee?.email || "Unassigned");
  return `<tr><td>${contactCell(l)}<small class="ref">#${esc(l.reference)} · ${esc(l.phone)}</small></td><td>${badgeType(l.leadType)}</td><td>${esc(interestOf(l))}</td><td>${esc(sourceLabel(l.source))}</td><td><select class="row-stage" data-id="${esc(l.id)}" aria-label="Lead status">${stageOptions(l.stage)}</select></td><td>${assignee}</td><td>${dateLabel(l.createdAt)}</td><td><button class="text-btn" data-detail="${esc(l.id)}">Details ↗</button></td></tr>`;
}

async function patchLead(id, body, successMsg) {
  try {
    await api(`/leads/${id}`, { method: "PATCH", body });
    toast(successMsg);
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

async function exportCsv() {
  const params = state.view === "reports"
    ? { from: $("#reportFrom").value, to: $("#reportTo").value }
    : ["leads", "customers", "developers", "agents"].includes(state.view) ? leadFilters() : {};
  try {
    const res = await api(`/leads/export?${qs(params)}`, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `crm-leads-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
    toast("CSV downloaded");
  } catch (err) { toast(err.message, true); }
}

// ---------- lead detail modal ----------
async function showDetail(id) {
  let data;
  try { data = await api(`/leads/${id}`); } catch (err) { return toast(err.message, true); }
  const { lead: l, activities, siteVisits } = data;
  const m = meta(l);
  const facts = [
    ["Email", l.email], ["Phone", l.phone], ["Reference", "#" + l.reference], ["Source", sourceLabel(l.source)],
    ["Property / project", l.propertyTitle], ["Property ID", l.propertyId], ["Assigned to", l.assignee?.email || "Unassigned"],
    ["Created", new Date(l.createdAt).toLocaleString("en-IN")], ["Consent to contact", l.contactConsent ? "Yes" : "No"],
    ...Object.entries(m).filter(([k, v]) => !k.startsWith("crm") && k !== "form" && v !== null && typeof v !== "object")
      .map(([k, v]) => [META_LABEL[k] || cap(k), v]),
    ["Page URL", l.pageUrl],
    ...("ipAddress" in l ? [["IP address", l.ipAddress], ["User agent", l.userAgent]] : []),
  ].filter(([, v]) => v !== null && v !== undefined && v !== "");

  $("#modalName").textContent = l.name;
  $("#modalBody").innerHTML = `
    <div class="badge-row">${badgeType(l.leadType)}${badgeStage(l.stage)}${badgeReview(l.review)}</div>
    <div class="detail-grid">${facts.map(([k, v]) => `<div class="detail-item${k === "Message" || k === "User agent" ? " wide" : ""}"><small>${esc(k.toUpperCase())}</small><b>${esc(v)}</b></div>`).join("")}</div>

    <form class="detail-actions" id="leadUpdateForm" data-id="${esc(l.id)}">
      <label>Status<select name="stage">${stageOptions(l.stage)}</select></label>
      ${isManager() ? `<label>Assigned to<select name="assignedTo">${teamOptions(l.assignedTo)}</select></label>` : ""}
      <button class="btn btn-primary">Save changes</button>
    </form>

    ${l.review && isManager() ? `
    <h4 class="modal-section">Submission review</h4>
    <form class="detail-actions" id="reviewForm" data-id="${esc(l.id)}">
      <label class="grow">Review note<input name="note" maxlength="1000" placeholder="Optional — e.g. RERA verified" value="${esc(l.review.note || "")}"></label>
      <button class="btn btn-primary" name="status" value="approved">Approve</button>
      <button class="btn btn-light" name="status" value="rejected">Reject</button>
    </form>
    ${l.review.reviewedBy ? `<p class="field-help">Last reviewed by ${esc(l.review.reviewedBy)} on ${esc(dateTimeLabel(l.review.reviewedAt))}.</p>` : ""}` : ""}

    <h4 class="modal-section">Follow-ups</h4>
    <div class="mini-list">${l.followUps.length ? l.followUps.slice().sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt)).map((f) =>
      `<div class="task"><button class="task-check ${f.doneAt ? "done" : ""}" data-followup="${esc(f.id)}" data-lead="${esc(l.id)}" data-done="${!!f.doneAt}" aria-label="Toggle done">${f.doneAt ? "✓" : ""}</button><div class="task-main"><b>${esc(f.note)}</b><small>${f.doneAt ? `Done by ${esc(f.doneBy)}` : `Added by ${esc(f.createdBy)}`}</small></div><span class="task-time ${!f.doneAt && new Date(f.dueAt) < new Date() ? "overdue" : ""}">${esc(dateTimeLabel(f.dueAt))}</span></div>`).join("") : `<p class="field-help">No follow-ups yet.</p>`}</div>
    <form class="detail-actions" id="followUpForm" data-id="${esc(l.id)}">
      <label>Due<input type="datetime-local" name="dueAt" required></label>
      <label class="grow">Note<input name="note" maxlength="500" required placeholder="e.g. Call back about 3 BHK options"></label>
      <button class="btn btn-light">＋ Add follow-up</button>
    </form>

    <h4 class="modal-section">Site visits</h4>
    <div class="mini-list">${siteVisits.length ? siteVisits.map((v) =>
      `<div class="visit-row"><div class="visit-date"><b>${new Date(v.scheduledAt).getDate()}</b><small>${new Date(v.scheduledAt).toLocaleString("en", { month: "short" }).toUpperCase()}</small></div><div><b>${esc(dateTimeLabel(v.scheduledAt))}</b><small>With ${esc(v.crmUser.email)}</small></div><select data-visit="${esc(v.id)}" aria-label="Visit status">${Object.entries(VISIT_STATUSES).map(([k, t]) => `<option value="${k}" ${k === v.status ? "selected" : ""}>${t}</option>`).join("")}</select></div>`).join("") : `<p class="field-help">No visits scheduled.</p>`}</div>
    <form class="detail-actions" id="leadVisitForm" data-id="${esc(l.id)}">
      <label>Date & time<input type="datetime-local" name="scheduledAt" required></label>
      ${isManager() ? `<label>Owner<select name="crmUserId">${teamOptions("", { label: "Lead's assignee" })}</select></label>` : ""}
      <label class="grow">Notes<input name="notes" maxlength="1000" placeholder="Meeting point / notes"></label>
      <button class="btn btn-light">＋ Schedule visit</button>
    </form>

    <h4 class="modal-section">Activity</h4>
    <form class="detail-actions" id="activityForm" data-id="${esc(l.id)}">
      <label>Type<select name="activityType"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="meeting">Meeting</option></select></label>
      <label class="grow">Details<input name="notes" maxlength="2000" required placeholder="What happened?"></label>
      <button class="btn btn-light">Log activity</button>
    </form>
    <ul class="activity-list">${activities.map((a) =>
      `<li><b>${esc(ACTIVITY_LABEL[a.activityType] || cap(a.activityType))}</b><span>${esc(a.notes || "")}</span><small>${esc(a.crmUser?.email || "")} · ${esc(dateTimeLabel(a.createdAt))}</small></li>`).join("") || `<li class="field-help">No activity yet.</li>`}</ul>`;
  $("#leadModal").classList.remove("hidden");
}

const formBody = (form) => Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
const toIso = (local) => (local ? new Date(local).toISOString() : "");

async function modalSubmit(e) {
  const form = e.target;
  const id = form.dataset.id;
  e.preventDefault();
  const button = e.submitter;
  if (button) button.disabled = true;
  try {
    const b = formBody(form);
    if (form.id === "leadUpdateForm") {
      const body = { stage: b.stage };
      if (isManager()) body.assignedTo = b.assignedTo || null;
      await api(`/leads/${id}`, { method: "PATCH", body });
      toast("Lead saved");
    } else if (form.id === "reviewForm") {
      await api(`/leads/${id}/review`, { method: "POST", body: { status: button.value, note: b.note } });
      toast(`Submission ${button.value}`);
    } else if (form.id === "followUpForm") {
      await api(`/leads/${id}/follow-ups`, { method: "POST", body: { dueAt: toIso(b.dueAt), note: b.note } });
      toast("Follow-up added");
    } else if (form.id === "leadVisitForm") {
      await api("/site-visits", { method: "POST", body: { leadId: id, scheduledAt: toIso(b.scheduledAt), crmUserId: b.crmUserId || null, notes: b.notes } });
      toast("Site visit scheduled");
    } else if (form.id === "activityForm") {
      await api("/activities", { method: "POST", body: { leadId: id, activityType: b.activityType, notes: b.notes } });
      toast("Activity logged");
    }
    await showDetail(id);
    refreshView();
  } catch (err) {
    toast(err.details ? Object.values(err.details).join(" ") : err.message, true);
    if (button) button.disabled = false;
  }
}

// ---------- follow-ups ----------
async function loadFollowups() {
  const status = $("#followStatus").value;
  const { followUps } = await api(`/leads/follow-ups?status=${status}`);
  $("#followPageCount").textContent = followUps.length;
  $("#followupCards").innerHTML = followUps.map((f) => {
    const overdue = !f.doneAt && new Date(f.dueAt) < new Date();
    return `<div class="follow-card ${overdue ? "is-overdue" : ""}"><button class="task-check ${f.doneAt ? "done" : ""}" data-followup="${esc(f.id)}" data-lead="${esc(f.lead.id)}" data-done="${!!f.doneAt}" aria-label="Toggle done">${f.doneAt ? "✓" : ""}</button><div><h4 class="clickable" data-detail="${esc(f.lead.id)}">${esc(f.lead.name)} · #${esc(f.lead.reference)}</h4><p>${esc(f.note)} · ${esc(f.lead.phone)}</p><small>${overdue ? "Overdue · " : ""}${esc(dateTimeLabel(f.dueAt))}${isManager() ? ` · ${esc(f.lead.assignee?.email || "Unassigned")}` : ""}</small></div></div>`;
  }).join("") || `<div class="empty-state">No ${status === "all" ? "" : status} follow-ups.</div>`;
}

async function toggleFollowUp(btn) {
  try {
    await api(`/leads/${btn.dataset.lead}/follow-ups/${btn.dataset.followup}`, { method: "PATCH", body: { done: btn.dataset.done !== "true" } });
    toast(btn.dataset.done === "true" ? "Follow-up reopened" : "Follow-up completed");
    if (!$("#leadModal").classList.contains("hidden")) await showDetail(btn.dataset.lead);
    refreshView();
  } catch (err) { toast(err.message, true); }
}

// ---------- site visits ----------
async function loadVisits() {
  const { visits } = await api(`/site-visits?${qs({ status: $("#visitStatusFilter").value })}`);
  $("#visitList").innerHTML = visits.map((v) => {
    const d = new Date(v.scheduledAt);
    return `<div class="visit-row"><div class="visit-date"><b>${d.getDate()}</b><small>${d.toLocaleString("en", { month: "short" }).toUpperCase()}</small></div><div><b class="clickable" data-detail="${esc(v.lead.id)}">${esc(v.lead.name)} · ${esc(v.lead.propertyTitle || "Property visit")}</b><small>${esc(dateTimeLabel(v.scheduledAt))} · ${esc(v.lead.phone)} · with ${esc(v.crmUser.email)}</small></div><select data-visit="${esc(v.id)}" aria-label="Visit status">${Object.entries(VISIT_STATUSES).map(([k, t]) => `<option value="${k}" ${k === v.status ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
  }).join("") || `<div class="empty-state">No site visits ${$("#visitStatusFilter").value === "all" ? "scheduled yet" : "with this status"}.</div>`;
}

const searchVisitLeads = debounce(async () => {
  const q = $("#visitLeadSearch").value.trim();
  try {
    const { items } = await api(`/leads?${qs({ q, pageSize: 20 })}`);
    $("#visitLead").innerHTML = items.length
      ? items.map((l) => `<option value="${esc(l.id)}">${esc(l.name)} · #${esc(l.reference)} · ${esc(l.phone)}</option>`).join("")
      : `<option value="">No matching leads</option>`;
  } catch (err) { toast(err.message, true); }
});

// ---------- submission review ----------
async function loadSubmissions() {
  const review = $("#reviewFilter").value;
  const { items, total } = await api(`/leads?${qs({ type: "submissions", review, pageSize: 100 })}`);
  $("#submissionCount").textContent = total;
  $("#propertySubmissions").innerHTML = items.map((l) => {
    const m = meta(l);
    return `<article class="submission-card"><div class="badge-row">${badgeType(l.leadType)}${badgeReview(l.review)}</div><h4>${esc(l.propertyTitle || "Untitled submission")}</h4><p>${esc(l.name)}${m.companyName || m.agencyName ? ` · ${esc(m.companyName || m.agencyName)}` : ""}</p><p>${esc([m.projectType || m.propertyType, m.listingType, m.projectLocation || m.location].filter(Boolean).join(" · ") || "No property details provided")}</p><p>${m.reraNumber ? `RERA ${esc(m.reraNumber)} · ` : ""}Submitted ${dateLabel(l.createdAt)}</p><div class="card-actions"><button class="btn btn-primary" data-review="approved" data-id="${esc(l.id)}">Approve</button><button class="btn btn-light" data-review="rejected" data-id="${esc(l.id)}">Reject</button><button class="text-btn" data-detail="${esc(l.id)}">Details →</button></div></article>`;
  }).join("") || `<div class="empty-state">No ${review === "all" ? "" : review} submissions.</div>`;
}

// ---------- team ----------
async function loadTeam() {
  await loadTeamCache();
  const admin = can("admin");
  $("#teamSubtitle").textContent = admin ? "Create users, change roles and deactivate accounts." : "Team roster and assigned leads (read-only).";
  $("#teamGrid").innerHTML = state.team.map((u) => {
    const st = u.leadStats;
    const self = u.id === state.me.id;
    return `<article class="team-card ${u.isActive ? "" : "inactive"}"><div class="team-head"><span class="contact-avatar ${u.role === "admin" ? "violet" : u.role === "sales_manager" ? "" : "green"}">${esc(initials(u.email))}</span><div><h4>${esc(u.email)}${self ? " (you)" : ""}</h4><p>${ROLE_LABEL[u.role]} · ${u.isActive ? "Active" : "Deactivated"}</p></div></div>
      <p><b>${st.assigned}</b> assigned · <b>${st.byStage.qualified || 0}</b> qualified · <b>${st.byStage.converted || 0}</b> converted</p>
      ${admin ? `<div class="card-actions">${self ? "" : `<select data-user-role="${esc(u.id)}" aria-label="Role">${Object.entries(ROLE_LABEL).map(([k, t]) => `<option value="${k}" ${k === u.role ? "selected" : ""}>${t}</option>`).join("")}</select><button class="btn btn-light" data-user-active="${esc(u.id)}" data-active="${u.isActive}">${u.isActive ? "Deactivate" : "Reactivate"}</button>`}<button class="btn btn-light" data-user-reset="${esc(u.id)}" data-email="${esc(u.email)}">Reset password</button></div>` : ""}
      <button class="text-btn" data-assignperson="${esc(u.id)}">View assigned leads →</button></article>`;
  }).join("") || `<div class="empty-state">No team members yet.</div>`;
}

async function updateUser(id, body, msg) {
  try {
    await api(`/sales-team/${id}`, { method: "PATCH", body });
    toast(msg);
  } catch (err) {
    toast(err.details ? Object.values(err.details).join(" ") : err.message, true);
  }
  loadTeam();
}

// ---------- reports ----------
async function loadReports() {
  const r = await api(`/reports/summary?${qs({ from: $("#reportFrom").value, to: $("#reportTo").value })}`);
  $("#rTotal").textContent = r.total;
  $("#rScope").textContent = r.scope === "assigned" ? "Leads assigned to you" : "All lead categories";
  $("#rConverted").textContent = r.byStage.converted;
  $("#rConversion").textContent = `${r.conversionRate}% conversion`;
  $("#rFollow").textContent = r.followUps.pending;
  $("#rOverdue").textContent = `${r.followUps.overdue} overdue`;
  $("#rUnassigned").textContent = r.scope === "assigned" ? "—" : r.unassigned;

  const head = (a, b, c, d) => `<div class="report-row report-head"><span>${a}</span><span>${b}</span><span>${c}</span><span>${d}</span></div>`;
  const bar = (n, of) => `<span class="report-track"><i style="width:${of ? (100 * n) / of : 0}%"></i></span>`;
  const cats = { customer: r.categories.customer, developer: { total: r.categories.developer.total + r.categories.builder.total, converted: r.categories.developer.converted + r.categories.builder.converted }, broker: r.categories.broker };
  $("#reportRows").innerHTML = head("CATEGORY", "SHARE", "LEADS", "CONVERTED") +
    Object.entries(cats).map(([t, c]) => `<div class="report-row"><span>${typeLabel(t)}</span>${bar(c.total, r.total)}<b>${c.total}</b><span>${c.converted}</span></div>`).join("");
  $("#stageRows").innerHTML = head("STATUS", "SHARE", "LEADS", "%") +
    STAGES.map((s) => `<div class="report-row"><span>${cap(s)}</span>${bar(r.byStage[s], r.total)}<b>${r.byStage[s]}</b><span>${r.total ? Math.round((100 * r.byStage[s]) / r.total) : 0}%</span></div>`).join("");
  $("#sourceRows").innerHTML = head("SOURCE", "SHARE", "LEADS", "%") +
    (r.bySource.map((s) => `<div class="report-row"><span>${esc(sourceLabel(s.source))}</span>${bar(s.count, r.total)}<b>${s.count}</b><span>${r.total ? Math.round((100 * s.count) / r.total) : 0}%</span></div>`).join("") || `<p class="field-help">No leads in this period.</p>`);
  if (r.byAssignee) {
    $("#assigneeRows").innerHTML = r.byAssignee.map((a) =>
      `<tr><td>${esc(a.user?.email || "Unassigned")}${a.user && !a.user.isActive ? " (inactive)" : ""}</td><td><b>${a.total}</b></td><td>${a.byStage.contacted}</td><td>${a.byStage.qualified}</td><td>${a.byStage.converted}</td></tr>`).join("") ||
      `<tr><td colspan="5" class="empty-state">No leads in this period.</td></tr>`;
  }
}

// ---------- settings ----------
async function renderSettings() {
  $("#accountLine").textContent = `${state.me.email} · ${ROLE_LABEL[state.me.role]}`;
  $("#apiBaseLabel").textContent = API;
  try {
    await api("/health");
    $("#healthLine").textContent = "Database connected ✓";
  } catch (err) {
    $("#healthLine").textContent = `Database check failed: ${err.message}`;
  }
}

// ---------- events ----------
function bind() {
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = $("#loginBtn");
    btn.disabled = true;
    $("#loginFeedback").classList.add("hidden");
    let user;
    try {
      ({ user } = await api("/auth/login", { method: "POST", body: { email: f.email.value.trim(), password: f.password.value } }));
    } catch (err) {
      feedback("loginFeedback", err.message, "error");
      return;
    } finally {
      btn.disabled = false;
    }
    state.session++;
    state.me = user;
    f.reset();
    // Loading the workspace is separate from signing in: if it fails (or the
    // user signs out meanwhile) it must not leave the login form stuck.
    startApp().catch((err) => toast(err.message, true));
  });
  $$("[data-logout]").forEach((b) => b.addEventListener("click", async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* clear locally regardless */ }
    state.session++;
    state.me = null;
    state.team = [];
    showLogin();
    feedback("loginFeedback", "You have been signed out.", "success");
  }));

  $$("#nav [data-view]").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
  $("#openNav").addEventListener("click", () => $("#sidebar").classList.add("open"));
  $("#closeNav").addEventListener("click", () => $("#sidebar").classList.remove("open"));
  $("#exportBtn").addEventListener("click", exportCsv);
  $("#reportExport").addEventListener("click", exportCsv);
  $("#chartRange").addEventListener("change", () => loadDashboard().catch((e) => toast(e.message, true)));

  const reloadLeads = () => { state.leadPage = 1; loadLeads().catch((e) => toast(e.message, true)); };
  $("#leadSearch").addEventListener("input", debounce(reloadLeads));
  $("#leadFilters").addEventListener("submit", (e) => { e.preventDefault(); reloadLeads(); });
  ["#stageFilter", "#typeFilter", "#sourceFilter", "#assigneeFilter"].forEach((s) => $(s).addEventListener("change", reloadLeads));
  $("#clearFilters").addEventListener("click", () => {
    const type = $("#typeFilter").value;
    $("#leadFilters").reset();
    if (CATEGORY_VIEWS[state.view]) $("#typeFilter").value = type;
    reloadLeads();
  });
  $("#prevPage").addEventListener("click", () => { state.leadPage--; loadLeads().catch((e) => toast(e.message, true)); });
  $("#nextPage").addEventListener("click", () => { state.leadPage++; loadLeads().catch((e) => toast(e.message, true)); });

  $("#followStatus").addEventListener("change", refreshView);
  $("#visitStatusFilter").addEventListener("change", refreshView);
  $("#reviewFilter").addEventListener("change", refreshView);
  $("#reportFrom").addEventListener("change", refreshView);
  $("#reportTo").addEventListener("change", refreshView);
  $("#reportReset").addEventListener("click", () => { $("#reportFrom").value = ""; $("#reportTo").value = ""; refreshView(); });

  $("#newVisitBtn").addEventListener("click", () => { $("#visitForm").classList.toggle("hidden"); searchVisitLeads(); });
  $("#visitLeadSearch").addEventListener("input", searchVisitLeads);
  $("#visitForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!$("#visitLead").value) return feedback("visitFeedback", "Choose a lead first.", "error");
    try {
      await api("/site-visits", { method: "POST", body: { leadId: $("#visitLead").value, scheduledAt: toIso($("#visitDate").value), crmUserId: isManager() ? $("#visitOwner").value || null : null, notes: $("#visitNotes").value.trim() } });
      e.target.reset();
      e.target.classList.add("hidden");
      $("#visitFeedback").classList.add("hidden");
      toast("Site visit scheduled");
      loadVisits();
    } catch (err) {
      feedback("visitFeedback", err.details ? Object.values(err.details).join(" ") : err.message, "error");
    }
  });

  $("#newUserBtn").addEventListener("click", () => $("#userForm").classList.toggle("hidden"));
  $("#userForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    clearFieldErrors(f);
    try {
      const { user } = await api("/sales-team", { method: "POST", body: formBody(f) });
      f.reset();
      feedback("userFeedback", `${user.email} created as ${ROLE_LABEL[user.role]}. Share the temporary password privately and ask them to change it after signing in.`, "success");
      loadTeam();
    } catch (err) {
      showFieldErrors(f, err.details);
      feedback("userFeedback", err.message, "error");
    }
  });

  $("#passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    clearFieldErrors(f);
    try {
      await api("/auth/password", { method: "POST", body: { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value } });
      f.reset();
      feedback("passwordFeedback", "Password changed. Other sessions have been signed out.", "success");
    } catch (err) {
      showFieldErrors(f, err.details);
      feedback("passwordFeedback", err.message, "error");
    }
  });

  $("#closeModal").addEventListener("click", () => $("#leadModal").classList.add("hidden"));
  $("#leadModal").addEventListener("click", (e) => { if (e.target.id === "leadModal") $("#leadModal").classList.add("hidden"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#leadModal").classList.add("hidden"); });
  $("#modalBody").addEventListener("submit", modalSubmit);

  document.addEventListener("click", async (e) => {
    const go_ = e.target.closest("[data-go]");
    if (go_) return go(go_.dataset.go);
    const fu = e.target.closest("[data-followup]");
    if (fu) return toggleFollowUp(fu);
    const detail = e.target.closest("[data-detail]");
    if (detail) return showDetail(detail.dataset.detail);
    const review = e.target.closest("[data-review]");
    if (review) {
      review.disabled = true;
      try {
        await api(`/leads/${review.dataset.id}/review`, { method: "POST", body: { status: review.dataset.review } });
        toast(`Submission ${review.dataset.review}`);
      } catch (err) { toast(err.message, true); }
      return loadSubmissions();
    }
    const person = e.target.closest("[data-assignperson]");
    if (person) {
      go("leads");
      $("#assigneeFilter").value = person.dataset.assignperson;
      return loadLeads();
    }
    const active = e.target.closest("[data-user-active]");
    if (active) {
      const deactivate = active.dataset.active === "true";
      if (deactivate && !confirm("Deactivate this user? They are signed out immediately and their leads return to the unassigned pool.")) return;
      return updateUser(active.dataset.userActive, { isActive: !deactivate }, deactivate ? "User deactivated" : "User reactivated");
    }
    const reset = e.target.closest("[data-user-reset]");
    if (reset) {
      const pwd = prompt(`New temporary password for ${reset.dataset.email} (10+ characters, letters and numbers):`);
      if (pwd) return updateUser(reset.dataset.userReset, { password: pwd }, "Password reset — their existing sessions are signed out");
    }
  });

  document.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.matches(".row-stage")) {
      if (await patchLead(el.dataset.id, { stage: el.value }, "Lead status updated")) refreshView();
    } else if (el.matches(".row-assignee")) {
      if (await patchLead(el.dataset.id, { assignedTo: el.value || null }, "Lead assignment updated")) refreshView();
    } else if (el.matches("[data-visit]")) {
      try {
        await api(`/site-visits/${el.dataset.visit}`, { method: "PATCH", body: { status: el.value } });
        toast("Visit status updated");
      } catch (err) { toast(err.message, true); }
      refreshView();
    } else if (el.matches("[data-user-role]")) {
      updateUser(el.dataset.userRole, { role: el.value }, "Role updated");
    }
  });
}

bind();
boot();
