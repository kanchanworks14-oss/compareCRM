// app/src/hooks/useApiData.js — load data for a page and reload it whenever
// `deps` change or the workspace refresh signal fires. Errors become toasts.
import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";

export function useApiData(load, deps) {
  const { refreshKey } = useWorkspace();
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => { if (alive) setData(d); })
      .catch((err) => { if (alive) toast(err.message, true); });
    return () => { alive = false; };
    // `load` is a fresh closure each render; `deps` lists what it reads.
  }, [...deps, refreshKey]);

  return data;
}

// Value that only updates after `ms` without changes (search boxes).
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
