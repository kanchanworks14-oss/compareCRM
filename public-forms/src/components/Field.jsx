// public-forms/src/components/Field.jsx — one labelled input/select/textarea
// with an optional hint and an error message linked for screen readers.
export default function Field({ formKey, field, error, defaultValue }) {
  const { name, label, required, wide, textarea, options, placeholder, hint, fromQuery, ...attrs } = field;
  const id = `${formKey}-${name}`;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const common = {
    id, name, required,
    "aria-invalid": error ? "true" : undefined,
    "aria-describedby": describedBy,
    defaultValue: defaultValue ?? "",
  };

  let control;
  if (options) {
    control = (
      <select {...common}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  } else if (textarea) {
    control = <textarea {...common} {...attrs} rows={4} placeholder={placeholder} />;
  } else {
    control = <input type="text" {...common} {...attrs} placeholder={placeholder} />;
  }

  return (
    <div className={`field${wide ? " wide" : ""}${error ? " has-error" : ""}`}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="req" aria-hidden="true"> *</span> : <span className="optional"> (optional)</span>}
      </label>
      {control}
      {hint && <small id={`${id}-hint`} className="hint">{hint}</small>}
      {error && <small id={`${id}-error`} className="error-text" role="alert">{error}</small>}
    </div>
  );
}
