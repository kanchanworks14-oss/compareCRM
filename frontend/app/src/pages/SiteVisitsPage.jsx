// app/src/pages/SiteVisitsPage.jsx — site visit list and "Schedule visit" form.
import { useEffect, useState } from "react";
import { api, errorText, qs } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useApiData, useDebounced } from "../hooks/useApiData.js";
import { dateTimeLabel, toIso } from "../lib/format.js";
import FormFeedback from "../components/FormFeedback.jsx";
import { TeamOptions, VisitStatusOptions } from "../components/Options.jsx";
import VisitRow from "../components/VisitRow.jsx";

export default function SiteVisitsPage() {
  const { openLead, setExportParams } = useWorkspace();
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  useEffect(() => setExportParams({}), [setExportParams]);

  const data = useApiData(() => api(`/site-visits?${qs({ status })}`), [status]);
  const visits = data?.visits ?? [];

  return (
    <section className="view">
      <div className="panel full-panel">
        <div className="panel-heading">
          <div><h3>Site visits</h3><p>Schedule a visit against a lead and track its status.</p></div>
          <div className="heading-actions">
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Visit status">
              <option value="all">All visits</option><VisitStatusOptions />
            </select>
            <button className="btn btn-primary" onClick={() => setFormOpen((o) => !o)}>＋ Schedule visit</button>
          </div>
        </div>
        {formOpen && <VisitForm onDone={() => setFormOpen(false)} />}
        <div className="visit-list">
          {data && !visits.length && <div className="empty-state">No site visits {status === "all" ? "scheduled yet" : "with this status"}.</div>}
          {visits.map((v) => (
            <VisitRow key={v.id} visit={v}>
              <b className="clickable" onClick={() => openLead(v.lead.id)}>{v.lead.name} · {v.lead.propertyTitle || "Property visit"}</b>
              <small>{dateTimeLabel(v.scheduledAt)} · {v.lead.phone} · with {v.crmUser.email}</small>
            </VisitRow>
          ))}
        </div>
      </div>
    </section>
  );
}

function VisitForm({ onDone }) {
  const { isManager } = useAuth();
  const { refresh } = useWorkspace();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState(null);
  const [leadId, setLeadId] = useState("");
  const [feedback, setFeedback] = useState(null);
  const q = useDebounced(search);

  useEffect(() => {
    let alive = true;
    api(`/leads?${qs({ q: q.trim(), pageSize: 20 })}`)
      .then(({ items }) => {
        if (!alive) return;
        setLeads(items);
        setLeadId(items[0]?.id ?? "");
      })
      .catch((err) => toast(err.message, true));
    return () => { alive = false; };
  }, [q, toast]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!leadId) return setFeedback({ msg: "Choose a lead first.", type: "error" });
    try {
      await api("/site-visits", {
        method: "POST",
        body: {
          leadId,
          scheduledAt: toIso(f.scheduledAt.value),
          crmUserId: isManager ? f.crmUserId.value || null : null,
          notes: f.notes.value.trim(),
        },
      });
      toast("Site visit scheduled");
      onDone();
      refresh();
    } catch (err) {
      setFeedback({ msg: errorText(err), type: "error" });
    }
  };

  return (
    <form className="inline-form" onSubmit={onSubmit}>
      <label>Find lead<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name, phone or reference" /></label>
      <label>Lead
        <select value={leadId} onChange={(e) => setLeadId(e.target.value)} required>
          {leads === null && <option value="">Search above…</option>}
          {leads?.length === 0 && <option value="">No matching leads</option>}
          {leads?.map((l) => <option key={l.id} value={l.id}>{l.name} · #{l.reference} · {l.phone}</option>)}
        </select>
      </label>
      <label>Date & time<input name="scheduledAt" type="datetime-local" required /></label>
      {isManager && <label>Visit owner<select name="crmUserId" defaultValue=""><TeamOptions emptyLabel="Lead's assignee" /></select></label>}
      <label>Visit notes<input name="notes" maxLength={1000} placeholder="Meeting point / notes" /></label>
      <button className="btn btn-primary">Save visit</button>
      <FormFeedback feedback={feedback} />
    </form>
  );
}
