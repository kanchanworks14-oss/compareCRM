// frontend/public-form.js — shared submit logic for the three public forms
// (customer.html, developer.html, broker.html).
//
// The form's data-endpoint names the backend route (/public/<type>). Success
// is only shown after the server replies 201/200 with a lead reference, i.e.
// after the row is committed to the database.
(() => {
  const API = (window.CRM_CONFIG?.apiBase || "http://localhost:4000/api/crm").replace(/\/$/, "");
  const form = document.querySelector("form[data-endpoint]");
  const box = document.getElementById("formFeedback");
  const button = form.querySelector("button[type=submit]");
  const buttonHtml = button.innerHTML;

  const show = (msg, type) => {
    box.textContent = msg;
    box.className = "form-feedback " + type;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const clearErrors = () => {
    form.querySelectorAll(".field-error").forEach((e) => e.remove());
    form.querySelectorAll(".invalid").forEach((e) => e.classList.remove("invalid"));
  };
  const fieldError = (name, msg) => {
    const input = form.elements[name];
    if (!input?.closest) return false;
    input.classList.add("invalid");
    (input.type === "checkbox" ? input.closest("label") : input).insertAdjacentHTML("afterend", `<small class="field-error"></small>`);
    (input.type === "checkbox" ? input.closest("label") : input).nextElementSibling.textContent = msg;
    return true;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();
    box.className = "form-feedback hidden";
    if (!form.checkValidity()) {
      for (const el of form.elements) if (el.name && !el.validity.valid) fieldError(el.name, el.validationMessage);
      form.querySelector(".invalid")?.focus();
      return;
    }

    const body = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === "checkbox") body[el.name] = el.checked;
      else if (el.type === "number") body[el.name] = el.value === "" ? null : Number(el.value);
      else body[el.name] = el.value.trim();
    }
    body.pageUrl = location.href.startsWith("http") ? location.href.split("#")[0] : null;

    button.disabled = true;
    button.innerHTML = "Submitting…";
    try {
      let res;
      try {
        res = await fetch(API + form.dataset.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch {
        throw new Error("We couldn't reach our server. Please check your connection and try again.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.reference) {
        if (data.details) for (const [k, v] of Object.entries(data.details)) fieldError(k, v);
        throw new Error(data.error || `Submission failed (${res.status}). Please try again.`);
      }
      form.reset();
      show(data.duplicate
        ? `We already received this enquiry (reference #${data.reference}). Our team will be in touch.`
        : `Thank you! Your submission was received. Reference #${data.reference}. Our team will contact you shortly.`, "success");
    } catch (err) {
      show(err.message, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = buttonHtml;
    }
  });
})();
