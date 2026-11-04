// app/src/components/FollowUpTask.jsx — one follow-up row with a done checkbox.
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { dateTimeLabel } from "../lib/format.js";

// `title`/`subtitle` differ between the dashboard list and the lead modal.
export default function FollowUpTask({ followUp: f, leadId, title, subtitle, onOpen }) {
  const { toggleFollowUp } = useWorkspace();
  const done = !!f.doneAt;
  const overdue = !done && new Date(f.dueAt) < new Date();
  return (
    <div className="task">
      <button
        className={`task-check${done ? " done" : ""}`}
        onClick={() => toggleFollowUp(leadId, f.id, done)}
        title={done ? "Reopen" : "Mark complete"}
        aria-label={done ? "Reopen" : "Mark complete"}
      >{done ? "✓" : ""}</button>
      <div className={`task-main${onOpen ? " clickable" : ""}`} onClick={onOpen}>
        <b>{title}</b><small>{subtitle}</small>
      </div>
      <span className={`task-time${overdue ? " overdue" : ""}`}>{overdue && onOpen ? "Overdue · " : ""}{dateTimeLabel(f.dueAt)}</span>
    </div>
  );
}
