// backend/routes/crm/leadsRoutes.js
//
// Read/update access to Lead records (backend/prisma/schema.prisma) — the
// same `leads` table the website's ingestion pipeline writes to. Scoped by
// role: sales reps only ever see leads assigned to them.
//
//   GET   /                         — list/filter (type, stage, source, assignedTo, q, from, to, review, page)
//   GET   /sources                  — distinct sources for the filter dropdown
//   GET   /follow-ups               — follow-up queue across visible leads
//   GET   /export                   — CSV of the filtered list        (admin, sales_manager)
//   GET   /:id                      — lead + activities + site visits
//   PATCH /:id                      — stage (all roles), assignedTo (admin, sales_manager)
//   POST  /:id/follow-ups           — schedule a follow-up
//   PATCH /:id/follow-ups/:followUpId — mark done / reopen
//   POST  /:id/review               — developer/broker submission review (admin, sales_manager)

import express from "express";
import {
  listLeads, listSources, getLead, updateLead, addFollowUp, updateFollowUp,
  listFollowUps, reviewSubmission, exportLeads,
} from "../../controllers/crm/leadsController.js";
import { requireRole, ROLES } from "../../middleware/auth.js";

const router = express.Router();
const managers = requireRole(ROLES.ADMIN, ROLES.MANAGER);

router.get("/", listLeads);
router.get("/sources", listSources);
router.get("/follow-ups", listFollowUps);
router.get("/export", managers, exportLeads);
router.get("/:id", getLead);
router.patch("/:id", updateLead);
router.post("/:id/follow-ups", addFollowUp);
router.patch("/:id/follow-ups/:followUpId", updateFollowUp);
router.post("/:id/review", managers, reviewSubmission);

export default router;
