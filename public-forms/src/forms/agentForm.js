// public-forms/src/forms/agentForm.js — Agent property submission.
// POST /api/crm/public/agent → Lead(leadType=agent, source=crm_agent_form) → Agent Leads.
import { PHONE, PROPERTY_TYPES, email } from "./fields.js";

export const agentForm = {
  key: "agent",
  endpoint: "/public/agent",
  submitLabel: "Submit property",
  consent: "I agree to be contacted by Compare Projects about this submission.",
  sections: [
    {
      title: "Agent details",
      fields: [
        { name: "name", label: "Full name", required: true, minLength: 2, maxLength: 100, autoComplete: "name", placeholder: "Your full name" },
        { name: "agencyName", label: "Agency name", required: true, maxLength: 150, autoComplete: "organization", placeholder: "e.g. Skyline Realty" },
        PHONE,
        email("you@agency.com"),
        { name: "reraNumber", label: "Agent RERA number", maxLength: 60, placeholder: "e.g. A51800012345" },
      ],
    },
    {
      title: "Property",
      fields: [
        { name: "propertyTitle", label: "Property / listing name", required: true, maxLength: 150, placeholder: "e.g. Bandra Office Space" },
        { name: "propertyType", label: "Property type", required: true, options: PROPERTY_TYPES, placeholder: "Select property type" },
        { name: "listingType", label: "Listing type", required: true, options: ["Sale", "Rent / Lease"], placeholder: "Sale or rent?" },
        { name: "location", label: "Property location", required: true, maxLength: 150, placeholder: "Locality, city" },
        { name: "expectedPrice", label: "Expected price / rent", maxLength: 60, placeholder: "e.g. ₹1.2 crore or ₹45,000/month" },
        { name: "message", label: "Listing details / reference ID", wide: true, textarea: true, maxLength: 2000, placeholder: "Size, floor, amenities, your internal reference…" },
      ],
    },
  ],
};
