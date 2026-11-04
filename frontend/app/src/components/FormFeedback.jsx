// app/src/components/FormFeedback.jsx — success/error box under a form.
import { forwardRef } from "react";

// `feedback` is { msg, type: "success" | "error" } or null (hidden).
const FormFeedback = forwardRef(function FormFeedback({ feedback, live = false }, ref) {
  return (
    <div
      ref={ref}
      className={`form-feedback ${feedback ? feedback.type : "hidden"}`}
      {...(live ? { role: "status", "aria-live": "polite" } : {})}
    >
      {feedback?.msg}
    </div>
  );
});

export default FormFeedback;

// Per-field server errors: <input className={invalid(errors, "email")}> + <FieldError ... />
export const invalid = (errors, name) => (errors?.[name] ? "invalid" : undefined);
export const FieldError = ({ errors, name }) => (errors?.[name] ? <small className="field-error">{errors[name]}</small> : null);
