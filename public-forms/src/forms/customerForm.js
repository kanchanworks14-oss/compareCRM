// public-forms/src/forms/customerForm.js — Customer enquiry.
// POST /api/crm/public/customer → Lead(leadType=customer, source=crm_customer_form).
import { PHONE, PROPERTY_TYPES, email } from "./fields.js";

export const customerForm = {
  key: "customer",
  endpoint: "/public/customer",
  submitLabel: "Send enquiry",
  consent: "I agree to be contacted by Compare Projects about this enquiry.",
  sections: [
    {
      title: "Your details",
      fields: [
        { name: "name", label: "Full name", required: true, minLength: 2, maxLength: 100, autoComplete: "name", placeholder: "e.g. Aditi Sharma" },
        PHONE,
        { ...email("you@example.com"), wide: true },
      ],
    },
    {
      title: "What you're looking for",
      fields: [
        { name: "location", label: "Preferred location", required: true, maxLength: 120, placeholder: "e.g. Andheri, Mumbai" },
        { name: "budget", label: "Budget range", options: ["Under ₹50 lakh", "₹50 lakh – ₹1 crore", "₹1 – 2 crore", "₹2 crore+"], placeholder: "Select budget" },
        { name: "propertyType", label: "Property type", options: PROPERTY_TYPES, placeholder: "Select property type" },
        { name: "propertyTitle", label: "Property / project of interest", maxLength: 150, placeholder: "Project name (optional)", fromQuery: true },
        { name: "message", label: "Additional details", wide: true, textarea: true, maxLength: 2000, placeholder: "Number of bedrooms, timeline, anything else…" },
      ],
    },
  ],
  // Sent with the enquiry when the page was opened with ?propertyId=…
  hidden: ["propertyId"],
};
