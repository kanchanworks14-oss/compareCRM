// backend/routes/crmRoutes.js
// Top-level mount point for the CRM app's entire API surface (/api/crm/*).
// Authentication uses the CrmUser model (backend/prisma/schema.prisma).
import express from "express";

import crmAuthRoutes from "./crm/authRoutes.js";
import crmPublicLeadsRoutes from "./crm/publicLeadsRoutes.js";
import crmLeadsRoutes from "./crm/leadsRoutes.js";
import crmActivitiesRoutes from "./crm/activitiesRoutes.js";
import crmSiteVisitsRoutes from "./crm/siteVisitsRoutes.js";
import crmSalesTeamRoutes from "./crm/salesTeamRoutes.js";
import crmReportsRoutes from "./crm/reportsRoutes.js";
import { requireAuth, requireCsrfHeader } from "../middleware/auth.js";

const router = express.Router();

// Public, unauthenticated: the three CRM-owned enquiry forms
router.use("/public", crmPublicLeadsRoutes);

// CrmUser login/session
router.use("/auth", requireCsrfHeader, crmAuthRoutes);

// Everything below requires a signed-in CrmUser
router.use(requireAuth, requireCsrfHeader);

// Viewing/updating Lead records ingested from the website's contact/enquiry forms
router.use("/leads", crmLeadsRoutes);

// LeadActivity — status changes, notes, audit trail per lead
router.use("/activities", crmActivitiesRoutes);

// SiteVisit — scheduling/tracking property visits with a lead
router.use("/site-visits", crmSiteVisitsRoutes);

// CrmUser management — sales team roster, roles, assignment
router.use("/sales-team", crmSalesTeamRoutes);

// Dashboard metrics and reports
router.use("/reports", crmReportsRoutes);

export default router;
