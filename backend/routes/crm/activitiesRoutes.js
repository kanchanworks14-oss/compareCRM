// backend/routes/crm/activitiesRoutes.js
//
// LeadActivity records (backend/prisma/schema.prisma) — the audit trail
// of notes/status-change events attached to a Lead, each tied to the
// CrmUser who performed it. Lead visibility rules apply.
//
//   GET  /?leadId=... — activity history for a given lead
//   POST /            — log a manual activity (note, call, email, whatsapp, meeting)

import express from "express";
import { listActivities, createActivity } from "../../controllers/crm/activitiesController.js";

const router = express.Router();

router.get("/", listActivities);
router.post("/", createActivity);

export default router;
