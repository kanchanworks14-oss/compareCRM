// app/src/pages/SettingsPage.jsx — account, password change, roles and
// backend connection status.
import { useEffect, useState } from "react";
import { API_BASE, api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { ROLE_LABEL } from "../lib/constants.js";
import FormFeedback, { FieldError, invalid } from "../components/FormFeedback.jsx";

export default function SettingsPage() {
  const { me, logout } = useAuth();
  const { setExportParams } = useWorkspace();
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [health, setHealth] = useState("Checking database…");

  useEffect(() => setExportParams({}), [setExportParams]);
  useEffect(() => {
    api("/health")
      .then(() => setHealth("Database connected ✓"))
      .catch((err) => setHealth(`Database check failed: ${err.message}`));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    setErrors({});
    try {
      await api("/auth/password", { method: "POST", body: { currentPassword: f.currentPassword.value, newPassword: f.newPassword.value } });
      f.reset();
      setFeedback({ type: "success", msg: "Password changed. Other sessions have been signed out." });
    } catch (err) {
      setErrors(err.details || {});
      setFeedback({ type: "error", msg: err.message });
    }
  };

  return (
    <section className="view">
      <div className="settings-grid">
        <div className="panel settings-panel">
          <div className="panel-heading"><div><h3>Your account</h3><p>{me.email} · {ROLE_LABEL[me.role]}</p></div></div>
          <form onSubmit={onSubmit} noValidate>
            <label>Current password
              <input name="currentPassword" type="password" autoComplete="current-password" required className={invalid(errors, "currentPassword")} />
              <FieldError errors={errors} name="currentPassword" />
            </label>
            <label>New password
              <input name="newPassword" type="password" autoComplete="new-password" minLength={10} required className={invalid(errors, "newPassword")} />
              <FieldError errors={errors} name="newPassword" />
            </label>
            <p className="field-help">At least 10 characters with letters and numbers. Changing it signs you out everywhere else.</p>
            <div className="settings-actions">
              <button className="btn btn-primary">Change password</button>
              <button className="btn btn-light" type="button" onClick={logout}>⎋ Sign out</button>
            </div>
            <FormFeedback feedback={feedback} />
          </form>
        </div>

        <div className="panel settings-panel">
          <div className="panel-heading"><div><h3>Access & roles</h3><p>Enforced by the server on every request</p></div></div>
          <div className="role-list static">
            <div><span className="role-avatar purple">SA</span><span><b>Super Admin</b><small>All leads, assignment, review, reports, CSV export and user management</small></span></div>
            <div><span className="role-avatar blue">SM</span><span><b>Sales Manager</b><small>All team leads, assignment, submission review, reports and CSV export</small></span></div>
            <div><span className="role-avatar green">SR</span><span><b>Sales Representative</b><small>Only leads assigned to them: status, notes, follow-ups and site visits</small></span></div>
          </div>
        </div>

        <div className="panel settings-panel setup-panel">
          <div className="panel-heading"><div><h3>Backend connection</h3><p>API address used by this build (<code>VITE_API_BASE</code>, default <code>/api/crm</code>)</p></div></div>
          <ul className="checklist"><li>API: <code>{API_BASE}</code></li><li>{health}</li></ul>
        </div>
      </div>
    </section>
  );
}
