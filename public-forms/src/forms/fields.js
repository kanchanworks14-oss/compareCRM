// public-forms/src/forms/fields.js — field presets shared by the form configs.
// Limits mirror backend/utils/validate.js and publicLeadsController.js.
export const PHONE = {
  name: "phone", label: "Phone number", type: "tel", required: true,
  pattern: "\\+?[0-9 \\(\\)\\-]{10,20}", autoComplete: "tel", placeholder: "+91 98765 43210",
  hint: "10–15 digits, with country code if outside India",
};

export const email = (placeholder) => ({
  name: "email", label: "Email address", type: "email", required: true, maxLength: 254, autoComplete: "email", placeholder,
});

export const PROPERTY_TYPES = ["Apartment", "Villa", "Plot / Land", "Commercial"];
