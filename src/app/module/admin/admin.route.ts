import { Router } from "express";
import { SystemRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import { AdminValidation } from "./admin.validation";

const router = Router();

router.get(
	"/users",
	auth(SystemRole.ADMIN, SystemRole.SUPER_ADMIN),
	validateRequest(AdminValidation.userQuerySchema, "query"),
	AdminController.getUsers,
);

router.get(
	"/organizations",
	auth(SystemRole.SUPER_ADMIN),
	validateRequest(AdminValidation.organizationQuerySchema, "query"),
	AdminController.getOrganizations,
);

router.get(
	"/projects",
	auth(SystemRole.SUPER_ADMIN),
	validateRequest(AdminValidation.projectQuerySchema, "query"),
	AdminController.getProjects,
);

router.get(
	"/subscriptions",
	auth(SystemRole.SUPER_ADMIN),
	validateRequest(AdminValidation.subscriptionQuerySchema, "query"),
	AdminController.getSubscriptions,
);

router.patch(
	"/users/:id/role",
	auth(SystemRole.SUPER_ADMIN),
	validateRequest(AdminValidation.updateUserRoleSchema),
	AdminController.updateUserRole,
);

router.get(
	"/dashboard-stats",
	auth(SystemRole.ADMIN, SystemRole.SUPER_ADMIN),
	AdminController.getDashboardStats,
);

router.get(
	"/audit-logs",
	auth(SystemRole.ADMIN, SystemRole.SUPER_ADMIN),
	validateRequest(AdminValidation.auditLogQuerySchema, "query"),
	AdminController.getAuditLogs,
);

export const AdminRoutes = router;
