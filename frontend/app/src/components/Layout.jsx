// app/src/components/Layout.jsx — signed-in shell: sidebar, top bar, page
// heading row, footer and the lead-detail modal.
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { MANAGERS, ROLE_LABEL, ROLE_SHORT } from "../lib/constants.js";
import { initials } from "../lib/format.js";
import { PAGES, ROUTES } from "../routes.jsx";
import LeadDetailModal from "../features/lead-detail/LeadDetailModal.jsx";

const Brand = ({ children }) => (
  <div className="brand">
    <div className="brand-mark">CP</div>
    <div><b>Compare Projects</b><small>CRM WORKSPACE</small></div>
    {children}
  </div>
);

export default function Layout({ children }) {
  const { me, can, logout } = useAuth();
  const { navCount, exportCsv, leadId } = useWorkspace();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const page = PAGES.find((p) => p.path === pathname) || PAGES[0];
  const visible = (r) => !r.roles || can(...r.roles);
  const go = (path) => {
    navigate(path);
    setNavOpen(false);
  };
  const heading = page.path === "/" ? `Welcome, ${me.email.split("@")[0]}` : page.title[1];

  return (
    <div className="app-shell">
      <aside className={`sidebar${navOpen ? " open" : ""}`}>
        <Brand><button className="mobile-close" onClick={() => setNavOpen(false)} aria-label="Close menu">×</button></Brand>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {ROUTES.map((r) => r.section
            ? <div key={r.section} className="workspace-label nav-spacer">{r.section}</div>
            : visible(r) && (
              <button key={r.path} className={`nav-item${r.path === page.path ? " active" : ""}`} onClick={() => go(r.path)}>
                <span>{r.icon}</span> {r.title[0]}{r.count && <em>{navCount}</em>}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar purple">{ROLE_SHORT[me.role]}</div>
            <div className="profile-text"><b>{me.email}</b><small>{ROLE_LABEL[me.role]}</small></div>
            <button onClick={logout} title="Sign out" aria-label="Sign out">⎋</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="Open menu">☰</button>
          <div className="crumb">Workspace <span>/</span> <b>{page.title[0]}</b></div>
          <div className="top-actions">
            <div className="live-pill"><i></i><span>Live database</span></div>
            <button className="top-avatar" onClick={() => go("/settings")} title="Account">{initials(me.email)}</button>
            <button className="btn btn-light top-logout" onClick={logout} title="Sign out">⎋ <span>Sign out</span></button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()}</div>
              <h1>{heading} <span>✦</span></h1>
              <p>{page.title[2]}</p>
            </div>
            <div className="welcome-actions">
              {can(...MANAGERS) && <button className="btn btn-light" onClick={() => exportCsv()}>⇩ Export CSV</button>}
            </div>
          </section>
          {children}
        </div>

        <footer className="footer">
          <span>© {new Date().getFullYear()} Compare Projects CRM</span>
          <span><i></i> Lead workspace <b>·</b> Role-based access</span>
        </footer>
      </main>

      {leadId && <LeadDetailModal key={leadId} id={leadId} />}
    </div>
  );
}
