// app/src/pages/FollowUpsPage.jsx — follow-up queue across visible leads.
import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useApiData } from "../hooks/useApiData.js";
import { dateTimeLabel } from "../lib/format.js";

export default function FollowUpsPage() {
  const { isManager } = useAuth();
  const { openLead, toggleFollowUp, setExportParams } = useWorkspace();
  const [status, setStatus] = useState("pending");
  useEffect(() => setExportParams({}), [setExportParams]);

  const data = useApiData(() => api(`/leads/follow-ups?status=${status}`), [status]);
  const followUps = data?.followUps ?? [];

  return (
    <section className="view">
      <div className="panel full-panel">
        <div className="panel-heading">
          <div><h3>Follow-up queue</h3><p>Add follow-ups from a lead's detail panel.</p></div>
          <div className="heading-actions">
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Follow-up status">
              <option value="pending">Pending</option><option value="done">Completed</option><option value="all">All</option>
            </select>
            <span className="count-badge">{followUps.length}</span>
          </div>
        </div>
        <div className="followup-cards">
          {data && !followUps.length && <div className="empty-state">No {status === "all" ? "" : status} follow-ups.</div>}
          {followUps.map((f) => {
            const done = !!f.doneAt;
            const overdue = !done && new Date(f.dueAt) < new Date();
            return (
              <div key={f.id} className={`follow-card${overdue ? " is-overdue" : ""}`}>
                <button className={`task-check${done ? " done" : ""}`} onClick={() => toggleFollowUp(f.lead.id, f.id, done)} aria-label="Toggle done">{done ? "✓" : ""}</button>
                <div>
                  <h4 className="clickable" onClick={() => openLead(f.lead.id)}>{f.lead.name} · #{f.lead.reference}</h4>
                  <p>{f.note} · {f.lead.phone}</p>
                  <small>{overdue ? "Overdue · " : ""}{dateTimeLabel(f.dueAt)}{isManager ? ` · ${f.lead.assignee?.email || "Unassigned"}` : ""}</small>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
