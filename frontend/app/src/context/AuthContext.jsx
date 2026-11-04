// app/src/context/AuthContext.jsx — the signed-in CRM user.
//
// On load it asks the server who is signed in (GET /auth/me). Role checks
// here only hide controls; the server enforces every rule.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, newSession, setUnauthorizedHandler } from "../api/client.js";
import { MANAGERS } from "../lib/constants.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState(null); // { msg, type } shown on the login screen
  const meRef = useRef(null);
  meRef.current = me;

  useEffect(() => {
    // Any 401 while signed in means the session expired or was revoked.
    setUnauthorizedHandler((msg) => {
      if (!meRef.current) return;
      newSession();
      setMe(null);
      setNotice({ msg, type: "error" });
    });
    api("/auth/me")
      .then(({ user }) => setMe(user))
      .catch((err) => setNotice(err.status === 401 ? null : { msg: err.message, type: "error" }))
      .finally(() => setBooting(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email, password) => {
    const { user } = await api("/auth/login", { method: "POST", body: { email, password } });
    newSession();
    setNotice(null);
    setMe(user);
  }, []);

  const logout = useCallback(async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* clear locally regardless */ }
    newSession();
    setMe(null);
    setNotice({ msg: "You have been signed out.", type: "success" });
  }, []);

  const value = useMemo(() => ({
    me, booting, notice, login, logout,
    can: (...roles) => !!me && roles.includes(me.role),
    isManager: !!me && MANAGERS.includes(me.role),
  }), [me, booting, notice, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
