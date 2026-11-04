// app/src/pages/DashboardPage.jsx — Overview: metrics, daily chart, pipeline,
// recent leads, upcoming follow-ups and quick actions.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useApiData } from "../hooks/useApiData.js";
import { MANAGERS, STAGES, STAGE_COLORS } from "../lib/constants.js";
import { cap, interestOf, plural } from "../lib/format.js";
import { StageBadge, TypeBadge } from "../components/Badges.jsx";
import ContactCell from "../components/ContactCell.jsx";
import FollowUpTask from "../components/FollowUpTask.jsx";
import LeadChart from "../components/LeadChart.jsx";

const EMPTY_STAGES = Object.fromEntries(STAGES.map((s) => [s, 0]));

export default function DashboardPage() {
  const { can } = useAuth();
  const { openLead, setNavCount, setExportParams } = useWorkspace();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);

  useEffect(() => setExportParams({}), [setExportParams]);

  const data = useApiData(async () => {
    const [summary, recent, follow] = await Promise.all([
      api(`/reports/summary?days=${days}`),
      api("/leads?pageSize=5"),
      api("/leads/follow-ups?status=pending"),
    ]);
    setNavCount(summary.total);
    return { summary, recent, follow };
  }, [days]);

  const summary = data?.summary;
  const s = summary?.byStage ?? EMPTY_STAGES;
  const total = summary?.total ?? 0;
  const conversion = summary?.conversionRate ?? 0;
  const assigned = summary?.scope === "assigned";
  const f = summary?.followUps;

  return (
    <section className="view">
      <div className="metric-grid">
        <Metric label="Total leads" icon="◉" color="blue" value={total} foot={assigned ? "Leads assigned to you" : "All categories"} />
        <Metric label="New enquiries" icon="✦" color="violet" value={s.new} foot="Status “New”, not yet contacted" />
        <Metric label="Qualified leads" icon="✓" color="green" value={s.qualified} foot="Status “Qualified”" />
        <Metric label="Conversion rate" icon="↗" color="orange" value={<>{conversion}<span>%</span></>} foot="Converted ÷ total leads">
          <div className="progress-track"><div style={{ width: `${Math.min(conversion, 100)}%` }} /></div>
        </Metric>
      </div>

      <div className="dash-grid">
        <article className="panel source-panel">
          <div className="panel-heading">
            <div><h3>Lead overview</h3><p>New enquiries per day by category</p></div>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option>
            </select>
          </div>
          <LeadChart rows={summary?.daily.rows ?? []} days={days} />
          <div className="chart-legend">
            <span><i className="dot customer-dot"></i>Customer</span>
            <span><i className="dot developer-dot"></i>Developer</span>
            <span><i className="dot agent-dot"></i>Agent</span>
            <span><i className="dot owner-dot"></i>Owner</span>
          </div>
        </article>

        <article className="panel pipeline-panel">
          <div className="panel-heading">
            <div><h3>Lead pipeline</h3><p>Current lead status</p></div>
            <button className="text-btn" onClick={() => navigate("/leads")}>View all →</button>
          </div>
          <div className="pipeline-total"><b>{total}</b><span>leads in pipeline</span></div>
          <div className="pipeline-line">
            {total
              ? STAGES.filter((st) => s[st]).map((st) => (
                <i key={st} style={{ width: `${(100 * s[st]) / total}%`, background: STAGE_COLORS[st] }} title={`${cap(st)}: ${s[st]}`} />
              ))
              : <i style={{ width: "100%", background: "#eef2f7" }} />}
          </div>
          <div className="pipeline-list">
            {STAGES.map((st) => (
              <div key={st}><span><i className={`stage-dot stage-${st}`}></i>{cap(st)}</span><b>{s[st]}</b></div>
            ))}
          </div>
        </article>
      </div>

      <div className="dash-grid lower-grid">
        <article className="panel leads-panel">
          <div className="panel-heading">
            <div><h3>Recent leads</h3><p>{assigned ? "Latest leads assigned to you" : "Latest enquiries from all sources"}</p></div>
            <button className="text-btn" onClick={() => navigate("/leads")}>View all leads →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>CONTACT</th><th>CATEGORY</th><th>PROPERTY INTEREST</th><th>STATUS</th><th>ASSIGNED TO</th></tr></thead>
              <tbody>
                {data && !data.recent.items.length && (
                  <tr><td colSpan={5} className="empty-state">No leads yet. Submissions from the public forms appear here.</td></tr>
                )}
                {data?.recent.items.map((l) => (
                  <tr key={l.id} className="clickable" onClick={() => openLead(l.id)}>
                    <td><ContactCell lead={l} /></td><td><TypeBadge type={l.leadType} /></td><td>{interestOf(l)}</td>
                    <td><StageBadge stage={l.stage} /></td><td>{l.assignee?.email || "Unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel tasks-panel">
          <div className="panel-heading">
            <div><h3>Upcoming follow-ups</h3><p>{f ? `${f.overdue} overdue · ${f.dueToday} due later today` : "Keep your leads moving"}</p></div>
            <span className="count-badge">{f?.pending ?? 0}</span>
          </div>
          <div className="task-list">
            {data && !data.follow.followUps.length && <p className="field-help">No pending follow-ups. Add one from a lead's details.</p>}
            {data?.follow.followUps.slice(0, 5).map((fu) => (
              <FollowUpTask key={fu.id} followUp={fu} leadId={fu.lead.id} title={fu.lead.name} subtitle={fu.note} onOpen={() => openLead(fu.lead.id)} />
            ))}
          </div>
          <button className="btn btn-outline full-btn" onClick={() => navigate("/follow-ups")}>View all follow-ups →</button>
        </article>
      </div>

      <div className="quick-actions">
        {can(...MANAGERS) && <QuickAction icon="♧" color="green" title="Manage your team" text="Assign leads to the right sales rep" button="Sales team ↗" onClick={() => navigate("/team")} />}
        <QuickAction
          icon="◷" color="orange" title="Plan site visits" button="View visits ↗" onClick={() => navigate("/site-visits")}
          text={summary ? `${plural(summary.upcomingVisits, "upcoming scheduled visit")}` : "Track upcoming property visits"}
        />
      </div>
    </section>
  );
}

function Metric({ label, icon, color, value, foot, children }) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span>{label}</span><span className={`metric-icon ${color}`}>{icon}</span></div>
      <div className="metric-number">{value}</div>
      <div className="metric-foot"><span>{foot}</span></div>
      {children}
    </article>
  );
}

function QuickAction({ icon, color, title, text, button, onClick }) {
  return (
    <div>
      <span className={`quick-icon ${color}`}>{icon}</span>
      <div><b>{title}</b><small>{text}</small></div>
      <button onClick={onClick}>{button}</button>
    </div>
  );
}
