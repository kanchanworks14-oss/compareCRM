// app/src/pages/LeadsPage.jsx — lead list with search, filters, paging and
// inline status/assignee changes. Also used for the Customer, Developer and
// Agent pages (`category` fixes the type filter).
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { api, qs } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { useApiData, useDebounced } from "../hooks/useApiData.js";
import { ROLES, STAGES } from "../lib/constants.js";
import { cap, dateLabel, interestOf, plural, sourceLabel, typeLabel } from "../lib/format.js";
import { TypeBadge } from "../components/Badges.jsx";
import ContactCell from "../components/ContactCell.jsx";
import { StageOptions, TeamOptions } from "../components/Options.jsx";

const PAGE_SIZE = 25;

export default function LeadsPage({ category }) {
  const { me, isManager } = useAuth();
  const { team, sources, openLead, refresh, setNavCount, setExportParams } = useWorkspace();
  const toast = useToast();
  const location = useLocation();

  // "View assigned leads" on the Team page arrives with an assignee preset.
  const initial = { q: "", stage: "all", type: category || "all", source: "all", assignedTo: location.state?.assignedTo || "" };
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1);
  const q = useDebounced(filters.q);

  // Built from the debounced search text so typing doesn't fire a request per key.
  const { stage, type, source, assignedTo } = filters;
  const params = useMemo(
    () => ({ q: q.trim(), stage, type, source, assignedTo: isManager ? assignedTo : "" }),
    [q, stage, type, source, assignedTo, isManager],
  );
  useEffect(() => setExportParams(params), [params, setExportParams]);

  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };
  const reset = () => {
    setFilters({ ...initial, assignedTo: "" });
    setPage(1);
  };

  const data = useApiData(async () => {
    const d = await api(`/leads?${qs({ ...params, page, pageSize: PAGE_SIZE })}`);
    const unfiltered = !params.q && params.stage === "all" && params.type === "all" && params.source === "all" && !params.assignedTo;
    if (!category && unfiltered) setNavCount(d.total);
    return d;
  }, [params, page]);

  const patchLead = async (id, body, msg) => {
    try {
      await api(`/leads/${id}`, { method: "PATCH", body });
      toast(msg);
      refresh();
    } catch (err) { toast(err.message, true); }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const emptyText = data?.total === 0 && !params.q && params.stage === "all"
    ? (me.role === ROLES.REP ? "No leads are assigned to you yet." : "No leads in this category yet.")
    : "No leads match these filters.";

  return (
    <section className="view">
      <form className="section-toolbar" onSubmit={(e) => e.preventDefault()}>
        <div className="filter-search">
          <span>⌕</span>
          <input value={filters.q} onChange={setFilter("q")} placeholder="Search name, email, phone, property or reference..." aria-label="Search leads" />
        </div>
        <select value={filters.stage} onChange={setFilter("stage")} aria-label="Status">
          <option value="all">All statuses</option>
          {STAGES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
        {!category && (
          <select value={filters.type} onChange={setFilter("type")} aria-label="Category">
            <option value="all">All categories</option>
            <option value="customer">Customer</option>
            <option value="developer">Developer</option>
            <option value="agent">Agent</option>
            <option value="owner">Owner</option>
          </select>
        )}
        {isManager && (
          <select value={filters.assignedTo} onChange={setFilter("assignedTo")} aria-label="Assigned to">
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            <option value="me">Me</option>
            {team.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
        )}
        <select value={filters.source} onChange={setFilter("source")} aria-label="Source">
          <option value="all">All sources</option>
          {sources.map((s) => <option key={s.source} value={s.source}>{sourceLabel(s.source)} ({s.count})</option>)}
        </select>
        <button className="btn btn-light" type="button" onClick={reset}>Reset filters</button>
      </form>

      <div className="panel full-panel">
        <div className="panel-heading">
          <div>
            <h3>{params.type === "all" ? "All leads" : `${typeLabel(params.type)} leads`}</h3>
            <p>{me.role === ROLES.REP ? "Leads assigned to you." : "Manage enquiries, ownership and next steps."}</p>
          </div>
          <span className="count-badge">{plural(data?.total ?? 0, "record")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>CONTACT</th><th>CATEGORY</th><th>PROPERTY / REQUIREMENT</th><th>SOURCE</th><th>STATUS</th><th>ASSIGNED TO</th><th>CREATED</th><th></th></tr></thead>
            <tbody>
              {data?.items.map((l) => (
                <tr key={l.id}>
                  <td><ContactCell lead={l} /><small className="ref">#{l.reference} · {l.phone}</small></td>
                  <td><TypeBadge type={l.leadType} /></td>
                  <td>{interestOf(l)}</td>
                  <td>{sourceLabel(l.source)}</td>
                  <td>
                    <select value={l.stage} onChange={(e) => patchLead(l.id, { stage: e.target.value }, "Lead status updated")} aria-label="Lead status">
                      <StageOptions />
                    </select>
                  </td>
                  <td>
                    {isManager
                      ? (
                        <select value={l.assignedTo || ""} onChange={(e) => patchLead(l.id, { assignedTo: e.target.value || null }, "Lead assignment updated")} aria-label="Assign lead">
                          <TeamOptions selected={l.assignedTo} />
                        </select>
                      )
                      : l.assignee?.email || "Unassigned"}
                  </td>
                  <td>{dateLabel(l.createdAt)}</td>
                  <td><button className="text-btn" onClick={() => openLead(l.id)}>Details ↗</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !data.items.length && <div className="empty-state">{emptyText}</div>}
        <div className="pager">
          <button className="btn btn-light" disabled={!data || data.page <= 1} onClick={() => setPage((p) => p - 1)}>← Previous</button>
          <span>{data ? `Page ${data.page} of ${pages}` : ""}</span>
          <button className="btn btn-light" disabled={!data || data.page >= pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      </div>
    </section>
  );
}
