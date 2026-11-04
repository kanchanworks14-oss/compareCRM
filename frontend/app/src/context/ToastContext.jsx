// app/src/context/ToastContext.jsx — the top-right status toast.
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { STALE } from "../api/client.js";

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ msg: "", error: false, show: false });
  const timer = useRef();

  const show = useCallback((msg, error = false) => {
    if (msg === STALE) return; // response from a previous session; nothing to report
    setToast({ msg, error, show: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      <div className={`toast${toast.show ? " show" : ""}${toast.error ? " error" : ""}`} role="status" aria-live="polite">{toast.msg}</div>
      {children}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
