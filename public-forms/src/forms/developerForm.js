// public-forms/src/forms/developerForm.js — Developer project submission.
// POST /api/crm/public/developer → Lead(leadType=developer, source=crm_developer_form).
import { PHONE, email } from "./fields.js";

export const developerForm = {
  key: "developer",
  endpoint: "/public/developer",
  submitLabel: "Submit project",
  consent: "I agree to be contacted by Compare Projects about this submission.",
  sections: [
    {
      title: "Company & contact",
      fields: [
        { name: "companyName", label: "Company / developer name", required: true, maxLength: 150, autoComplete: "organization", placeholder: "e.g. Greenfield Developers" },
        { name: "name", label: "Contact person", required: true, minLength: 2, maxLength: 100, autoComplete: "name", placeholder: "Your full name" },
        PHONE,
        email("you@company.com"),
      ],
    },
    {
      title: "Project",
      fields: [
        { name: "projectName", label: "Project name", required: true, maxLength: 150, placeholder: "e.g. Greenfield Towers" },
        { name: "projectLocation", label: "Project location", required: true, maxLength: 150, placeholder: "Locality, city" },
        { name: "projectType", label: "Project type", required: true, options: ["Residential", "Commercial", "Mixed-use", "Plotted development"], placeholder: "Select project type" },
        { name: "totalUnits", label: "Total units", type: "number", min: 1, max: 100000, step: 1, placeholder: "e.g. 240" },
        { name: "reraNumber", label: "RERA registration number", maxLength: 60, placeholder: "e.g. P51700012345" },
        { name: "possession", label: "Expected possession", maxLength: 40, placeholder: "e.g. Dec 2028 / Ready to move" },
        { name: "message", label: "Project details / approvals", wide: true, textarea: true, maxLength: 2000, placeholder: "Configurations, amenities, approvals, pricing…" },
      ],
    },
  ],
};
