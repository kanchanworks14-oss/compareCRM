// public-forms/src/components/EnquiryForm.jsx — renders a form config and
// submits it to the CRM backend.
//
// 1. Browser validation (required, format, length) before anything is sent.
// 2. One request at a time: the button locks and repeat clicks are ignored.
// 3. The backend validates again; its per-field errors are shown in place.
// 4. Success is only shown once the backend returns a lead reference.
import { useEffect, useRef, useState } from "react";
import { SubmitError, submitEnquiry } from "../lib/api.js";
import Field from "./Field.jsx";
import { AlertIcon, ArrowIcon, CheckIcon } from "./Icons.jsx";

// Body shape the backend expects: checkbox → boolean, number → number|null, text trimmed.
const readForm = (form) => {
  const body = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === "checkbox") body[el.name] = el.checked;
    else if (el.type === "number") body[el.name] = el.value === "" ? null : Number(el.value);
    else body[el.name] = el.value.trim();
  }
  body.pageUrl = location.href.startsWith("http") ? location.href.split("#")[0] : null;
  return body;
};

export default function EnquiryForm({ config, initial = {} }) {
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const formRef = useRef();
  const topRef = useRef();

  // Move focus to the first field with an error after it renders.
  useEffect(() => {
    if (Object.keys(errors).length) formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [errors]);
  useEffect(() => {
    if (result || alert) topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [result, alert]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (inFlight.current) return;
    const form = e.currentTarget;
    setAlert(null);

    if (!form.checkValidity()) {
      const errs = {};
      for (const el of form.elements) if (el.name && !el.validity.valid) errs[el.name] = el.validationMessage;
      setErrors(errs);
      return;
    }
    setErrors({});

    inFlight.current = true;
    setBusy(true);
    try {
      setResult(await submitEnquiry(config.endpoint, readForm(form)));
    } catch (err) {
      const details = err instanceof SubmitError && err.details ? err.details : {};
      setErrors(details);
      setAlert(err.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="form-card success-card" ref={topRef} role="status" aria-live="polite">
        <span className="success-icon"><CheckIcon size={30} /></span>
        <h2>{result.duplicate ? "We already have your enquiry" : "Thank you — enquiry received"}</h2>
        <p>
          {result.duplicate
            ? "You sent us this enquiry recently, so we haven't created a second one. Our team will be in touch."
            : "Our team will review your details and contact you shortly."}
        </p>
        <p className="reference">Reference <b>#{result.reference}</b></p>
        <div className="success-actions">
          <button className="btn btn-outline" onClick={() => setResult(null)}>Send another enquiry</button>
          <a className="btn btn-link" href="/forms/">Back to forms</a>
        </div>
      </div>
    );
  }

  return (
    <form className="form-card" ref={formRef} onSubmit={onSubmit} onReset={() => { setErrors({}); setAlert(null); }} noValidate aria-busy={busy}>
      <div ref={topRef} />
      {alert && (
        <div className="alert alert-error" role="alert">
          <AlertIcon size={20} />
          <span>{alert}</span>
        </div>
      )}

      {config.sections.map((section) => (
        <fieldset key={section.title} className="form-section" disabled={busy}>
          <legend>{section.title}</legend>
          <div className="field-grid">
            {section.fields.map((f) => (
              <Field key={f.name} formKey={config.key} field={f} error={errors[f.name]} defaultValue={f.fromQuery ? initial[f.name] : undefined} />
            ))}
          </div>
        </fieldset>
      ))}

      {config.hidden?.map((name) => initial[name] ? <input key={name} type="hidden" name={name} value={initial[name]} /> : null)}

      {/* Honeypot: hidden from people, filled by bots. The backend drops those submissions. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={`${config.key}-website`}>Leave this empty</label>
        <input id={`${config.key}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={`consent${errors.contactConsent ? " has-error" : ""}`}>
        <label>
          <input
            name="contactConsent" type="checkbox" required disabled={busy}
            aria-invalid={errors.contactConsent ? "true" : undefined}
            aria-describedby={errors.contactConsent ? `${config.key}-consent-error` : undefined}
          />
          <span>{config.consent} <span className="req" aria-hidden="true">*</span></span>
        </label>
        {errors.contactConsent && <small id={`${config.key}-consent-error`} className="error-text" role="alert">{errors.contactConsent}</small>}
      </div>

      <div className="form-actions">
        <button type="reset" className="btn btn-ghost" disabled={busy}>Clear form</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <><span className="spinner" aria-hidden="true" /> Sending…</> : <>{config.submitLabel} <ArrowIcon size={18} /></>}
        </button>
      </div>
      <p className="form-note"><span className="req">*</span> Required fields</p>
    </form>
  );
}
