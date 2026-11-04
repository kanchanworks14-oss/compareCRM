// app/src/pages/TeamPage.jsx — sales team roster. Admins create users,
// change roles, deactivate and reset passwords; managers see it read-only.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api, errorText } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useWorkspace } from "../context/WorkspaceContext.jsx";
import { ROLE_LABEL, ROLES } from "../lib/constants.js";
import { formBody, initials } from "../lib/format.js";
import FormFeedback, { FieldError, invalid } from "../components/FormFeedback.jsx";

const AVATAR_CLASS = { admin: "violet", sales_manager: "", sales_rep: "green" };

export default function TeamPage() {
  const { can } = useAuth();
  const { team, reloadTeam, refreshKey, setExportParams } = useWorkspace();
  const [formOpen, setFormOpen] = useState(false);
  const admin = can(ROLES.ADMIN);

  useEffect(() => setExportParams({}), [setExportParams]);
  useEffect(() => { reloadTeam(); }, [reloadTeam, refreshKey]);

  return (
    <section className="view">
      <div className="panel full-panel">
        <div className="panel-heading">
          <div><h3>Sales team</h3><p>{admin ? "Create users, change roles and deactivate accounts." : "Team roster and assigned leads (read-only)."}</p></div>
          {admin && <button className="btn btn-primary" onClick={() => setFormOpen((o) => !o)}>＋ Add team member</button>}
        </div>
        {admin && formOpen && <NewUserForm />}
        <div className="team-grid">
          {!team.length && <div className="empty-state">No team members yet.</div>}
          {team.map((u) => <TeamCard key={u.id} user={u} admin={admin} />)}
        </div>
      </div>
    </section>
  );
}

function NewUserForm() {
  const { reloadTeam } = useWorkspace();
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    setErrors({});
    try {
      const { user } = await api("/sales-team", { method: "POST", body: formBody(f) });
      f.reset();
      setFeedback({ type: "success", msg: `${user.email} created as ${ROLE_LABEL[user.role]}. Share the temporary password privately and ask them to change it after signing in.` });
      reloadTeam();
    } catch (err) {
      setErrors(err.details || {});
      setFeedback({ type: "error", msg: err.message });
    }
  };

  return (
    <form className="inline-form" onSubmit={onSubmit} noValidate>
      <label>Email<input name="email" type="email" required autoComplete="off" className={invalid(errors, "email")} /><FieldError errors={errors} name="email" /></label>
      <label>Role
        <select name="role" defaultValue={ROLES.REP}>
          <option value="sales_rep">Sales Representative</option><option value="sales_manager">Sales Manager</option><option value="admin">Super Admin</option>
        </select>
        <FieldError errors={errors} name="role" />
      </label>
      <label>Temporary password
        <input name="password" type="password" minLength={10} required autoComplete="new-password" placeholder="10+ chars, letters & numbers" className={invalid(errors, "password")} />
        <FieldError errors={errors} name="password" />
      </label>
      <button className="btn btn-primary">Create user</button>
      <FormFeedback feedback={feedback} />
    </form>
  );
}

function TeamCard({ user: u, admin }) {
  const { me } = useAuth();
  const { reloadTeam } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();
  const self = u.id === me.id;
  const st = u.leadStats;

  const update = async (body, msg) => {
    try {
      await api(`/sales-team/${u.id}`, { method: "PATCH", body });
      toast(msg);
    } catch (err) { toast(errorText(err), true); }
    reloadTeam();
  };

  const toggleActive = () => {
    if (u.isActive && !confirm("Deactivate this user? They are signed out immediately and their leads return to the unassigned pool.")) return;
    update({ isActive: !u.isActive }, u.isActive ? "User deactivated" : "User reactivated");
  };

  const resetPassword = () => {
    const pwd = prompt(`New temporary password for ${u.email} (10+ characters, letters and numbers):`);
    if (pwd) update({ password: pwd }, "Password reset — their existing sessions are signed out");
  };

  return (
    <article className={`team-card${u.isActive ? "" : " inactive"}`}>
      <div className="team-head">
        <span className={`contact-avatar ${AVATAR_CLASS[u.role]}`}>{initials(u.email)}</span>
        <div><h4>{u.email}{self ? " (you)" : ""}</h4><p>{ROLE_LABEL[u.role]} · {u.isActive ? "Active" : "Deactivated"}</p></div>
      </div>
      <p><b>{st.assigned}</b> assigned · <b>{st.byStage.qualified || 0}</b> qualified · <b>{st.byStage.converted || 0}</b> converted</p>
      {admin && (
        <div className="card-actions">
          {!self && (
            <>
              <select value={u.role} onChange={(e) => update({ role: e.target.value }, "Role updated")} aria-label="Role">
                {Object.entries(ROLE_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
              <button className="btn btn-light" onClick={toggleActive}>{u.isActive ? "Deactivate" : "Reactivate"}</button>
            </>
          )}
          <button className="btn btn-light" onClick={resetPassword}>Reset password</button>
        </div>
      )}
      <button className="text-btn" onClick={() => navigate("/leads", { state: { assignedTo: u.id } })}>View assigned leads →</button>
    </article>
  );
}
