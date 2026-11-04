// app/src/pages/SubmissionsPage.jsx — approve/reject developer and agent
// submissions (admin, sales_manager).
import { useEffect, useState } from "react";
import { api, qs } from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useApiData } from "../hooks/useApiData.js";
import { dateLabel, meta } from "../lib/format.js";
import { ReviewBadge, TypeBadge } from "../components/Badges.jsx";

export default function SubmissionsPage() {
  const { setExportParams } = useWorkspace();
  const [review, setReview] = useState("pending");
  useEffect(() => setExportParams({}), [setExportParams]);

  const data = useApiData(() => api(`/leads?${qs({ type: "submissions", review, pageSize: 100 })}`), [review]);

  return (
    <section className="view">
      <div className="panel full-panel">
        <div className="panel-heading">
          <div><h3>Developer & agent submissions</h3><p>Approve or reject projects and properties submitted through the public forms.</p></div>
          <div className="heading-actions">
            <select value={review} onChange={(e) => setReview(e.target.value)} aria-label="Review status">
              <option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option>
            </select>
            <span className="count-badge">{data?.total ?? 0}</span>
          </div>
        </div>
        <div className="submission-grid">
          {data && !data.items.length && <div className="empty-state">No {review === "all" ? "" : review} submissions.</div>}
          {data?.items.map((l) => <SubmissionCard key={l.id} lead={l} />)}
        </div>
      </div>
    </section>
  );
}

function SubmissionCard({ lead: l }) {
  const { openLead, refresh } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const m = meta(l);
  const company = m.companyName || m.agencyName;
  const details = [m.projectType || m.propertyType, m.listingType, m.projectLocation || m.location].filter(Boolean).join(" · ");

  const decide = async (status) => {
    setBusy(true);
    try {
      await api(`/leads/${l.id}/review`, { method: "POST", body: { status } });
      toast(`Submission ${status}`);
    } catch (err) { toast(err.message, true); }
    setBusy(false);
    refresh();
  };

  return (
    <article className="submission-card">
      <div className="badge-row"><TypeBadge type={l.leadType} /><ReviewBadge review={l.review} /></div>
      <h4>{l.propertyTitle || "Untitled submission"}</h4>
      <p>{l.name}{company ? ` · ${company}` : ""}</p>
      <p>{details || "No property details provided"}</p>
      <p>{m.reraNumber ? `RERA ${m.reraNumber} · ` : ""}Submitted {dateLabel(l.createdAt)}</p>
      <div className="card-actions">
        <button className="btn btn-primary" disabled={busy} onClick={() => decide("approved")}>Approve</button>
        <button className="btn btn-light" disabled={busy} onClick={() => decide("rejected")}>Reject</button>
        <button className="text-btn" onClick={() => openLead(l.id)}>Details →</button>
      </div>
    </article>
  );
}
