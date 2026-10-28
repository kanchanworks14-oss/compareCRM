// backend/routes/crm/publicLeadsRoutes.js
//
// Unauthenticated intake for the three public forms. Rate-limited per IP.
// These do NOT replace the website's own enquiry pipeline — they are
// separate CRM-owned forms whose rows carry a `crm_*` source.
//
//   POST /customer   — customer property enquiry      → Lead(leadType=customer)
//   POST /developer  — developer project submission   → Lead(leadType=developer)
//   POST /broker     — agent/broker property listing  → Lead(leadType=broker)

import express from "express";
import { submitLead } from "../../controllers/crm/publicLeadsController.js";
import { rateLimit } from "../../utils/rateLimit.js";

const router = express.Router();

router.use(rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.PUBLIC_FORM_RATE_LIMIT) || 5,
  message: "Too many submissions from this network. Please try again in a few minutes.",
}));

router.post("/customer", submitLead("customer"));
router.post("/developer", submitLead("developer"));
router.post("/broker", submitLead("broker"));

export default router;
