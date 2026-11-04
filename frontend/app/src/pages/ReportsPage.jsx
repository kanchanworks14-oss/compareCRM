// app/src/pages/ReportsPage.jsx — totals and breakdowns for a date range.
import { useEffect, useMemo, useState } from "react";
import { api, qs } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useApiData } from "../hooks/useApiData.js";
import { MANAGERS, STAGES } from "../lib/constants.js";
import { cap, sourceLabel, typeLabel } from "../lib/format.js";

const pct = (n, of) => (of ? Math.round((100 * n) / of) : 0);

const Head = ({ cols }) => <div className="report-row report-head">{cols.map((c) => <span key={c}>{c}</span>)}</div>;
const Row = ({ label, n, of, last }) => (
  <div className="report-row">
    <span>{label}</span>
    <span className="report-track"><i style={{ width: `${of ? (100 * n) / of : 0}%` }} /></span>
    <b>{n}</b><span>{last}</span>
  </div>
);
const Panel = ({ title, subtitle, children }) => (
  <div className="panel report-breakdown">
    <div className="panel-heading"><div><h3>{title}</h3><p>{subtitle}</p></div></div>
    {children}
  </div>
);

export default function ReportsPage() {
  const { can } = useAuth();
  const { exportCsv, setExportParams } = useWorkspace();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = useMemo(() => ({ from, to }), [from, to]);
  useEffect(() => setExportParams(range), [range, setExportParams]);

  const r = useApiData(() => api(`/reports/summary?${qs(range)}`), [range]);
  const assigned = r?.scope === "assigned";
  const total = r?.total ?? 0;
  const cats = r && {
    customer: r.categories.customer,
    developer: r.categories.developer,
    agent: r.categories.agent,
    owner: r.categories.owner,
  };

  return (
    <section className="view">
      <form className="section-toolbar" onSubmit={(e) => e.preventDefault()}>
        <label className="inline-date">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="inline-date">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="btn btn-light" type="button" onClick={() => { setFrom(""); setTo(""); }}>All time</button>
        {can(...MANAGERS) && <button className="btn btn-light" type="button" onClick={() => exportCsv(range)}>⇩ Export CSV</button>}
      </form>

      <div className="metric-grid report-metrics">
        <Metric label="Total enquiries" icon="◉" color="blue" value={total} foot={assigned ? "Leads assigned to you" : "All lead categories"} />
        <Metric label="Converted" icon="✓" color="green" value={r?.byStage.converted ?? 0} foot={`${r?.conversionRate ?? 0}% conversion`} />
        <Metric label="Pending follow-ups" icon="◷" color="orange" value={r?.followUps.pending ?? 0} foot={`${r?.followUps.overdue ?? 0} overdue`} />
        <Metric label="Unassigned" icon="♧" color="violet" value={assigned ? "—" : r?.unassigned ?? 0} foot="Awaiting assignment" />
      </div>

      {r && (
        <div className="report-grid">
          <Panel title="Category performance" subtitle="Leads and conversions by category">
            <Head cols={["CATEGORY", "SHARE", "LEADS", "CONVERTED"]} />
            {Object.entries(cats).map(([t, c]) => <Row key={t} label={typeLabel(t)} n={c.total} of={total} last={c.converted} />)}
          </Panel>
          <Panel title="Status breakdown" subtitle="Where leads are in the pipeline">
            <Head cols={["STATUS", "SHARE", "LEADS", "%"]} />
            {STAGES.map((s) => <Row key={s} label={cap(s)} n={r.byStage[s]} of={total} last={`${pct(r.byStage[s], total)}%`} />)}
          </Panel>
          <Panel title="Lead sources" subtitle="Top sources by volume">
            <Head cols={["SOURCE", "SHARE", "LEADS", "%"]} />
            {r.bySource.map((s) => <Row key={s.source} label={sourceLabel(s.source)} n={s.count} of={total} last={`${pct(s.count, total)}%`} />)}
            {!r.bySource.length && <p className="field-help">No leads in this period.</p>}
          </Panel>
          {can(...MANAGERS) && r.byAssignee && (
            <Panel title="Team performance" subtitle="Leads per owner">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>OWNER</th><th>LEADS</th><th>CONTACTED</th><th>QUALIFIED</th><th>CONVERTED</th></tr></thead>
                  <tbody>
                    {r.byAssignee.map((a) => (
                      <tr key={a.user?.id ?? "unassigned"}>
                        <td>{a.user?.email || "Unassigned"}{a.user && !a.user.isActive ? " (inactive)" : ""}</td>
                        <td><b>{a.total}</b></td><td>{a.byStage.contacted}</td><td>{a.byStage.qualified}</td><td>{a.byStage.converted}</td>
                      </tr>
                    ))}
                    {!r.byAssignee.length && <tr><td colSpan={5} className="empty-state">No leads in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      )}
    </section>
  );
}

function Metric({ label, icon, color, value, foot }) {
  return (
    <article className="metric-card">
      <div className="metric-top">{label} <span className={`metric-icon ${color}`}>{icon}</span></div>
      <div className="metric-number">{value}</div>
      <div className="metric-foot">{foot}</div>
    </article>
  );
}
