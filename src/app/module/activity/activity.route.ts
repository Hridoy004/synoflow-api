import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ActivityController } from "./activity.controller";
import { ActivityValidation } from "./activity.validation";

const organizationActivityRouter = Router({ mergeParams: true });
organizationActivityRouter.get(
	"/",
	auth(),
	validateRequest(ActivityValidation.activityQuerySchema, "query"),
	ActivityController.getOrganizationActivities,
);

const taskActivityRouter = Router({ mergeParams: true });
taskActivityRouter.get(
	"/",
	auth(),
	validateRequest(ActivityValidation.activityQuerySchema, "query"),
	ActivityController.getTaskActivities,
);

export const OrganizationActivityRoutes = organizationActivityRouter;
export const TaskActivityRoutes = taskActivityRouter;
