// app/src/context/WorkspaceContext.jsx — state shared across dashboard pages:
// the team roster (for assignment dropdowns), lead sources, the nav lead
// count, the open lead-detail modal and a refresh signal.
//
// Every mutation calls refresh(); pages and the lead modal reload their data
// when `refreshKey` changes.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, qs } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";
import { useToast } from "./ToastContext.jsx";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { isManager } = useAuth();
  const toast = useToast();
  const [team, setTeam] = useState([]);
  const [sources, setSources] = useState([]);
  const [navCount, setNavCount] = useState(0);
  const [leadId, setLeadId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const exportParams = useRef({});

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const reloadTeam = useCallback(async () => {
    try {
      setTeam((await api("/sales-team")).users);
    } catch (err) { toast(err.message, true); }
  }, [toast]);

  useEffect(() => {
    if (isManager) reloadTeam();
    api("/leads/sources").then((d) => setSources(d.sources)).catch(() => { /* filter is optional */ });
  }, [isManager, reloadTeam]);

  const toggleFollowUp = useCallback(async (leadId_, followUpId, done) => {
    try {
      await api(`/leads/${leadId_}/follow-ups/${followUpId}`, { method: "PATCH", body: { done: !done } });
      toast(done ? "Follow-up reopened" : "Follow-up completed");
      refresh();
    } catch (err) { toast(err.message, true); }
  }, [toast, refresh]);

  // CSV of the current page's filters (pages register them via setExportParams).
  const exportCsv = useCallback(async (params = exportParams.current) => {
    try {
      const res = await api(`/leads/export?${qs(params)}`, { raw: true });
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `crm-leads-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click();
      URL.revokeObjectURL(url);
      toast("CSV downloaded");
    } catch (err) { toast(err.message, true); }
  }, [toast]);

  const value = useMemo(() => ({
    team, reloadTeam, sources, navCount, setNavCount,
    leadId, openLead: setLeadId, closeLead: () => setLeadId(null),
    refreshKey, refresh, toggleFollowUp, exportCsv,
    setExportParams: (p) => { exportParams.current = p; },
  }), [team, reloadTeam, sources, navCount, leadId, refreshKey, refresh, toggleFollowUp, exportCsv]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceContext);
