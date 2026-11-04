// app/src/App.jsx — dashboard root: boot screen → login → workspace.
import { HashRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { PAGES } from "./routes.jsx";

function Workspace() {
  const { can } = useAuth();
  return (
    <WorkspaceProvider>
      <Layout>
        <Routes>
          {PAGES.map((p) => (
            <Route key={p.path} path={p.path} element={!p.roles || can(...p.roles) ? p.element : <Navigate to="/" replace />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </WorkspaceProvider>
  );
}

function Gate() {
  const { me, booting } = useAuth();
  if (booting) return <div className="auth-screen"><div className="empty-state">Connecting to CRM…</div></div>;
  // Keyed by user so a new sign-in starts with fresh workspace state.
  return me ? <Workspace key={me.id} /> : <LoginPage />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
