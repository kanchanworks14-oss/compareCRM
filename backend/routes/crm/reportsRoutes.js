// backend/routes/crm/reportsRoutes.js
//
// Dashboard metrics and reports, scoped to what the caller may see.
// CSV export lives at GET /api/crm/leads/export (admin, sales_manager).
//
//   GET /summary?from=&to=&days= — counts by category/stage/source/assignee, daily trend, follow-up and visit totals

import express from "express";
import { summary } from "../../controllers/crm/reportsController.js";

const router = express.Router();

router.get("/summary", summary);

export default router;
