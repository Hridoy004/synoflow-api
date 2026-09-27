import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { LabelController } from "./label.controller";
import { LabelValidation } from "./label.validation";

const organizationLabelRouter = Router({ mergeParams: true });
organizationLabelRouter.post(
	"/",
	auth(),
	validateRequest(LabelValidation.createLabelSchema, "body"),
	LabelController.createLabel,
);
organizationLabelRouter.get(
	"/",
	auth(),
	validateRequest(LabelValidation.labelQuerySchema, "query"),
	LabelController.getOrganizationLabels,
);

const labelRouter = Router();
labelRouter.patch(
	"/:labelId",
	auth(),
	validateRequest(LabelValidation.updateLabelSchema),
	LabelController.updateLabel,
);
labelRouter.delete("/:labelId", auth(), LabelController.deleteLabel);

const taskLabelRouter = Router({ mergeParams: true });
taskLabelRouter.post(
	"/",
	auth(),
	validateRequest(LabelValidation.taskLabelBody),
	LabelController.attachLabelToTask,
);
taskLabelRouter.delete(
	"/:labelId",
	auth(),
	LabelController.detachLabelFromTask,
);

export const OrganizationLabelRoutes = organizationLabelRouter;
export const LabelRoutes = labelRouter;
export const TaskLabelRoutes = taskLabelRouter;
