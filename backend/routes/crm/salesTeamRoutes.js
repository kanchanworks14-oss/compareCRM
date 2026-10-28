// backend/routes/crm/salesTeamRoutes.js
//
// CrmUser management (backend/prisma/schema.prisma) — the sales team
// roster: roles (admin/sales_manager/sales_rep) and active status.
//
//   GET   /     — roster with assigned-lead stats   (admin, sales_manager)
//   POST  /     — create a CrmUser                   (admin)
//   PATCH /:id  — role / isActive / password reset   (admin)

import express from "express";
import { listUsers, createUser, updateUser } from "../../controllers/crm/salesTeamController.js";
import { requireRole, ROLES } from "../../middleware/auth.js";

const router = express.Router();

router.get("/", requireRole(ROLES.ADMIN, ROLES.MANAGER), listUsers);
router.post("/", requireRole(ROLES.ADMIN), createUser);
router.patch("/:id", requireRole(ROLES.ADMIN), updateUser);

export default router;
