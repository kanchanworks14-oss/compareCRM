// app/src/features/lead-detail/LeadDetailModal.jsx — one lead: facts,
// status/assignment, submission review, follow-ups, site visits and the
// activity log. Every save calls refresh(), which also reloads this modal.
import { useEffect, useState } from "react";
import { api, errorText } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useWorkspace } from "../../context/WorkspaceContext.jsx";
import { ACTIVITY_LABEL, META_LABEL, MANUAL_ACTIVITY_TYPES } from "../../lib/constants.js";
import { cap, dateTimeLabel, formBody, meta, sourceLabel, toIso } from "../../lib/format.js";
import { ReviewBadge, StageBadge, TypeBadge } from "../../components/Badges.jsx";
import FollowUpTask from "../../components/FollowUpTask.jsx";
import { StageOptions, TeamOptions } from "../../components/Options.jsx";
import VisitRow from "../../components/VisitRow.jsx";

const WIDE_FACTS = ["Message", "User agent"];

const factsOf = (l) => [
  ["Email", l.email], ["Phone", l.phone], ["Reference", `#${l.reference}`], ["Source", sourceLabel(l.source)],
  ["Property / project", l.propertyTitle], ["Property ID", l.propertyId], ["Assigned to", l.assignee?.email || "Unassigned"],
  ["Created", new Date(l.createdAt).toLocaleString("en-IN")], ["Consent to contact", l.contactConsent ? "Yes" : "No"],
  ...Object.entries(meta(l))
    .filter(([k, v]) => !k.startsWith("crm") && k !== "form" && v !== null && typeof v !== "object")
    .map(([k, v]) => [META_LABEL[k] || cap(k), v]),
  ["Page URL", l.pageUrl],
  ...("ipAddress" in l ? [["IP address", l.ipAddress], ["User agent", l.userAgent]] : []), // admins only
].filter(([, v]) => v !== null && v !== undefined && v !== "");

export default function LeadDetailModal({ id }) {
  const { isManager } = useAuth();
  const { closeLead, refresh, refreshKey } = useWorkspace();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [version, setVersion] = useState(0); // remounts the forms (clears inputs) after each reload

  useEffect(() => {
    let alive = true;
    api(`/leads/${id}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setVersion((v) => v + 1);
      })
      .catch((err) => {
        toast(err.message, true);
        if (alive && !data) closeLead();
      });
    return () => { alive = false; };
    // `data`/`closeLead` only matter for the first load's failure path.
  }, [id, refreshKey]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeLead(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeLead]);

  // Shared submit handler for the sub-forms: (body, submitter) → [request, success message]
  const submitWith = (build) => async (e) => {
    e.preventDefault();
    const button = e.nativeEvent.submitter;
    if (button) button.disabled = true;
    try {
      const [path, method, body, msg] = build(formBody(e.currentTarget), button);
      await api(path, { method, body });
      toast(msg);
      refresh();
    } catch (err) {
      toast(errorText(err), true);
      if (button) button.disabled = false;
    }
  };

  if (!data) return null;
  const { lead: l, activities, siteVisits } = data;
  const followUps = l.followUps.slice().sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closeLead(); }}>
      <div className="modal lead-modal" role="dialog" aria-modal="true" aria-labelledby="modalName">
        <div className="modal-head">
          <div><div className="eyebrow">LEAD DETAILS</div><h3 id="modalName">{l.name}</h3></div>
          <button className="icon-btn" onClick={closeLead} aria-label="Close">×</button>
        </div>

        <div key={version}>
          <div className="badge-row"><TypeBadge type={l.leadType} /><StageBadge stage={l.stage} /><ReviewBadge review={l.review} /></div>
          <div className="detail-grid">
            {factsOf(l).map(([k, v]) => (
              <div key={k} className={`detail-item${WIDE_FACTS.includes(k) ? " wide" : ""}`}><small>{k.toUpperCase()}</small><b>{v}</b></div>
            ))}
          </div>

          <form className="detail-actions" onSubmit={submitWith((b) => [
            `/leads/${l.id}`, "PATCH", isManager ? { stage: b.stage, assignedTo: b.assignedTo || null } : { stage: b.stage }, "Lead saved",
          ])}>
            <label>Status<select name="stage" defaultValue={l.stage}><StageOptions /></select></label>
            {isManager && <label>Assigned to<select name="assignedTo" defaultValue={l.assignedTo || ""}><TeamOptions selected={l.assignedTo} /></select></label>}
            <button className="btn btn-primary">Save changes</button>
          </form>

          {l.review && isManager && (
            <>
              <h4 className="modal-section">Submission review</h4>
              <form className="detail-actions" onSubmit={submitWith((b, button) => [
                `/leads/${l.id}/review`, "POST", { status: button.value, note: b.note }, `Submission ${button.value}`,
              ])}>
                <label className="grow">Review note<input name="note" maxLength={1000} placeholder="Optional — e.g. RERA verified" defaultValue={l.review.note || ""} /></label>
                <button className="btn btn-primary" name="status" value="approved">Approve</button>
                <button className="btn btn-light" name="status" value="rejected">Reject</button>
              </form>
              {l.review.reviewedBy && <p className="field-help">Last reviewed by {l.review.reviewedBy} on {dateTimeLabel(l.review.reviewedAt)}.</p>}
            </>
          )}

          <h4 className="modal-section">Follow-ups</h4>
          <div className="mini-list">
            {!followUps.length && <p className="field-help">No follow-ups yet.</p>}
            {followUps.map((f) => (
              <FollowUpTask key={f.id} followUp={f} leadId={l.id} title={f.note} subtitle={f.doneAt ? `Done by ${f.doneBy}` : `Added by ${f.createdBy}`} />
            ))}
          </div>
          <form className="detail-actions" onSubmit={submitWith((b) => [
            `/leads/${l.id}/follow-ups`, "POST", { dueAt: toIso(b.dueAt), note: b.note }, "Follow-up added",
          ])}>
            <label>Due<input type="datetime-local" name="dueAt" required /></label>
            <label className="grow">Note<input name="note" maxLength={500} required placeholder="e.g. Call back about 3 BHK options" /></label>
            <button className="btn btn-light">＋ Add follow-up</button>
          </form>

          <h4 className="modal-section">Site visits</h4>
          <div className="mini-list">
            {!siteVisits.length && <p className="field-help">No visits scheduled.</p>}
            {siteVisits.map((v) => (
              <VisitRow key={v.id} visit={v}><b>{dateTimeLabel(v.scheduledAt)}</b><small>With {v.crmUser.email}</small></VisitRow>
            ))}
          </div>
          <form className="detail-actions" onSubmit={submitWith((b) => [
            "/site-visits", "POST", { leadId: l.id, scheduledAt: toIso(b.scheduledAt), crmUserId: b.crmUserId || null, notes: b.notes }, "Site visit scheduled",
          ])}>
            <label>Date & time<input type="datetime-local" name="scheduledAt" required /></label>
            {isManager && <label>Owner<select name="crmUserId" defaultValue=""><TeamOptions emptyLabel="Lead's assignee" /></select></label>}
            <label className="grow">Notes<input name="notes" maxLength={1000} placeholder="Meeting point / notes" /></label>
            <button className="btn btn-light">＋ Schedule visit</button>
          </form>

          <h4 className="modal-section">Activity</h4>
          <form className="detail-actions" onSubmit={submitWith((b) => [
            "/activities", "POST", { leadId: l.id, activityType: b.activityType, notes: b.notes }, "Activity logged",
          ])}>
            <label>Type
              <select name="activityType" defaultValue="note">
                {Object.entries(MANUAL_ACTIVITY_TYPES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </label>
            <label className="grow">Details<input name="notes" maxLength={2000} required placeholder="What happened?" /></label>
            <button className="btn btn-light">Log activity</button>
          </form>
          <ul className="activity-list">
            {!activities.length && <li className="field-help">No activity yet.</li>}
            {activities.map((a) => (
              <li key={a.id}>
                <b>{ACTIVITY_LABEL[a.activityType] || cap(a.activityType)}</b>
                <span>{a.notes || ""}</span>
                <small>{a.crmUser?.email || ""} · {dateTimeLabel(a.createdAt)}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
