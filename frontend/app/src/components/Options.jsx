// app/src/components/Options.jsx — <option> lists reused by several selects.
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { ROLE_SHORT, STAGES, VISIT_STATUSES } from "../lib/constants.js";
import { cap } from "../lib/format.js";

// Active team members (plus the currently selected one, even if inactive).
export function TeamOptions({ selected = "", emptyLabel = "Unassigned" }) {
  const { team } = useWorkspace();
  return (
    <>
      {emptyLabel !== null && <option value="">{emptyLabel}</option>}
      {team.filter((u) => u.isActive || u.id === selected).map((u) => (
        <option key={u.id} value={u.id}>{u.email} · {ROLE_SHORT[u.role]}</option>
      ))}
    </>
  );
}

export const StageOptions = () => STAGES.map((s) => <option key={s} value={s}>{cap(s)}</option>);

export const VisitStatusOptions = () =>
  Object.entries(VISIT_STATUSES).map(([k, t]) => <option key={k} value={k}>{t}</option>);
