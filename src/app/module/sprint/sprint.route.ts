import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SprintController } from "./sprint.controller";
import { SprintValidation } from "./sprint.validation";

const projectSprintRouter = Router({ mergeParams: true });
projectSprintRouter.post(
  "/",
  auth(),
  validateRequest(SprintValidation.createSprintSchema),
  SprintController.createSprint,
);
projectSprintRouter.get(
  "/",
  auth(),
  validateRequest(SprintValidation.sprintQuerySchema, "query"),
  SprintController.getProjectSprints,
);

const sprintRouter = Router();
sprintRouter.get("/:sprintId", auth(), SprintController.getSprint);
sprintRouter.patch(
  "/:sprintId",
  auth(),
  validateRequest(SprintValidation.updateSprintSchema),
  SprintController.updateSprint,
);
sprintRouter.delete("/:sprintId", auth(), SprintController.deleteSprint);
sprintRouter.post("/:sprintId/start", auth(), SprintController.startSprint);
sprintRouter.post(
  "/:sprintId/complete",
  auth(),
  SprintController.completeSprint,
);

export const ProjectSprintRoutes = projectSprintRouter;
export const SprintRoutes = sprintRouter;
