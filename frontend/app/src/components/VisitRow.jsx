// app/src/components/VisitRow.jsx — a site visit with its status dropdown.
import { api } from "../api/client.js";
import { useToast } from "../context/ToastContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { VisitStatusOptions } from "./Options.jsx";

export default function VisitRow({ visit: v, children }) {
  const toast = useToast();
  const { refresh } = useWorkspace();
  const d = new Date(v.scheduledAt);

  const setStatus = async (status) => {
    try {
      await api(`/site-visits/${v.id}`, { method: "PATCH", body: { status } });
      toast("Visit status updated");
    } catch (err) { toast(err.message, true); }
    refresh();
  };

  return (
    <div className="visit-row">
      <div className="visit-date"><b>{d.getDate()}</b><small>{d.toLocaleString("en", { month: "short" }).toUpperCase()}</small></div>
      <div>{children}</div>
      <select value={v.status} onChange={(e) => setStatus(e.target.value)} aria-label="Visit status"><VisitStatusOptions /></select>
    </div>
  );
}
