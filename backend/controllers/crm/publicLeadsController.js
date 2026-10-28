// backend/controllers/crm/publicLeadsController.js
//
// Handlers for backend/routes/crm/publicLeadsRoutes.js — the three public
// forms (customer enquiry, developer project, agent/broker property).
//
// Each submission becomes one `Lead` row with the matching LeadType. Only
// existing columns are written; form-specific fields that have no column
// (location, budget, company, RERA no., etc.) go into `Lead.metadata`.
// `source` is prefixed `crm_` so these rows are always distinguishable from
// leads written by the website's own ingestion pipeline.
import prisma from "../../config/prisma.js";
import { validate, HttpError } from "../../utils/validate.js";

const BUDGETS = ["Under ₹50 lakh", "₹50 lakh – ₹1 crore", "₹1 – 2 crore", "₹2 crore+"];
const DUPLICATE_WINDOW_MS = 24 * 3600 * 1000;

const common = {
  name: { type: "string", required: true, min: 2, max: 100 },
  email: { type: "email", required: true },
  phone: { type: "phone", required: true },
  contactConsent: { type: "bool", required: true },
  pageUrl: { type: "url" },
  website: { type: "string", max: 200 }, // honeypot — real users never see or fill it
};

export const FORMS = {
  customer: {
    leadType: "customer",
    source: "crm_customer_form",
    spec: {
      location: { type: "string", required: true, max: 120 },
      budget: { type: "enum", values: BUDGETS },
      propertyType: { type: "enum", values: ["Apartment", "Villa", "Plot / Land", "Commercial"] },
      propertyTitle: { type: "string", max: 150 },
      propertyId: { type: "string", max: 64, pattern: /^[A-Za-z0-9_-]+$/, patternMessage: "Invalid property id." },
      message: { type: "text", max: 2000 },
    },
    metadataKeys: ["location", "budget", "propertyType", "message"],
  },
  developer: {
    leadType: "developer",
    source: "crm_developer_form",
    spec: {
      companyName: { type: "string", required: true, max: 150 },
      projectName: { type: "string", required: true, max: 150 },
      projectLocation: { type: "string", required: true, max: 150 },
      projectType: { type: "enum", required: true, values: ["Residential", "Commercial", "Mixed-use", "Plotted development"] },
      totalUnits: { type: "int", min: 1, max: 100000 },
      reraNumber: { type: "string", max: 60 },
      possession: { type: "string", max: 40 },
      message: { type: "text", max: 2000 },
    },
    title: (d) => d.projectName,
    metadataKeys: ["companyName", "projectLocation", "projectType", "totalUnits", "reraNumber", "possession", "message"],
  },
  broker: {
    leadType: "broker",
    source: "crm_broker_form",
    spec: {
      agencyName: { type: "string", required: true, max: 150 },
      reraNumber: { type: "string", max: 60 },
      propertyTitle: { type: "string", required: true, max: 150 },
      propertyType: { type: "enum", required: true, values: ["Apartment", "Villa", "Plot / Land", "Commercial"] },
      listingType: { type: "enum", required: true, values: ["Sale", "Rent / Lease"] },
      location: { type: "string", required: true, max: 150 },
      expectedPrice: { type: "string", max: 60 },
      message: { type: "text", max: 2000 },
    },
    metadataKeys: ["agencyName", "reraNumber", "propertyType", "listingType", "location", "expectedPrice", "message"],
  },
};

export const reference = (id) => id.slice(0, 8).toUpperCase();

export const submitLead = (formKey) => async (req, res) => {
  const form = FORMS[formKey];
  const d = validate(req.body, { ...common, ...form.spec });
  if (d.contactConsent !== true) {
    throw new HttpError(400, "Please correct the highlighted fields.", { contactConsent: "Consent is required to submit." });
  }
  const propertyTitle = form.title ? form.title(d) : d.propertyTitle ?? null;

  // Bots fill the hidden honeypot. Pretend success, store nothing.
  if (d.website) return res.status(201).json({ ok: true, reference: "RECEIVED" });

  // Same person, same form, same property within 24h = a double submit, not a new lead.
  const existing = await prisma.lead.findFirst({
    where: {
      leadType: form.leadType,
      email: { equals: d.email, mode: "insensitive" },
      phone: d.phone,
      propertyTitle,
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    select: { id: true, createdAt: true },
  });
  if (existing) {
    return res.status(200).json({ ok: true, duplicate: true, id: existing.id, reference: reference(existing.id), createdAt: existing.createdAt });
  }

  const metadata = { form: formKey };
  for (const k of form.metadataKeys) if (d[k] !== null && d[k] !== undefined) metadata[k] = d[k];

  const lead = await prisma.lead.create({
    data: {
      leadType: form.leadType,
      name: d.name,
      email: d.email,
      phone: d.phone,
      source: form.source,
      propertyId: d.propertyId ?? null,
      propertyTitle,
      contactConsent: true,
      metadata,
      pageUrl: d.pageUrl,
      ipAddress: req.ip,
      userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
    },
    select: { id: true, createdAt: true },
  });
  res.status(201).json({ ok: true, id: lead.id, reference: reference(lead.id), createdAt: lead.createdAt });
};
