// backend/routes/crm/siteVisitsRoutes.js
//
// SiteVisit records (backend/prisma/schema.prisma) — scheduling and
// tracking property visits between a Lead and the CrmUser handling it.
//
//   GET   /?leadId=&status=&upcoming=true — visits visible to the user
//   POST  /                              — schedule a visit
//   PATCH /:id                           — status (scheduled/completed/cancelled/no_show) or reschedule

import express from "express";
import { listVisits, createVisit, updateVisit } from "../../controllers/crm/siteVisitsController.js";

const router = express.Router();

router.get("/", listVisits);
router.post("/", createVisit);
router.patch("/:id", updateVisit);

export default router;
