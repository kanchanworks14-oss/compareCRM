// app/src/pages/LoginPage.jsx — sign-in. Accounts are created by a Super
// Admin; there is no public registration.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import FormFeedback from "../components/FormFeedback.jsx";

export default function LoginPage() {
  const { login, notice } = useAuth();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(notice);
  const emailRef = useRef();

  useEffect(() => { setFeedback(notice); }, [notice]);
  useEffect(() => { emailRef.current?.focus(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    setBusy(true);
    setFeedback(null);
    try {
      await login(f.email.value.trim(), f.password.value);
    } catch (err) {
      setFeedback({ msg: err.message, type: "error" });
      setBusy(false);
    }
  };

  return (
    <section className="auth-screen">
      <form className="auth-card panel" onSubmit={onSubmit} noValidate>
        <div className="brand"><div className="brand-mark">CP</div><div><b>Compare Projects</b><small>CRM WORKSPACE</small></div></div>
        <h2>Sign in</h2>
        <p className="field-help">Use the account your CRM administrator created for you.</p>
        <div className="field-grid single">
          <label>Email address<input ref={emailRef} name="email" type="email" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        </div>
        <button className="btn btn-primary full-btn" type="submit" disabled={busy}>Sign in <span>→</span></button>
        <FormFeedback feedback={feedback} />
        <p className="field-help auth-foot">No account? Ask your Super Admin to add you from the Sales Team page.</p>
      </form>
    </section>
  );
}
