import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ProjectController } from "./project.controller";
import { ProjectValidation } from "./project.validation";

const organizationProjectRouter = Router({ mergeParams: true });
organizationProjectRouter.post(
	"/",
	auth(),
	validateRequest(ProjectValidation.createProjectSchema),
	ProjectController.createProject,
);
organizationProjectRouter.get(
	"/",
	auth(),
	validateRequest(ProjectValidation.projectQuerySchema, "query"),
	ProjectController.getOrganizationProjects,
);

const projectRouter = Router();
projectRouter.get("/:projectId", auth(), ProjectController.getProject);
projectRouter.patch(
	"/:projectId",
	auth(),
	validateRequest(ProjectValidation.updateProjectSchema),
	ProjectController.updateProject,
);
projectRouter.delete("/:projectId", auth(), ProjectController.deleteProject);
projectRouter.post(
	"/:projectId/members",
	auth(),
	validateRequest(ProjectValidation.projectMemberSchema),
	ProjectController.addProjectMember,
);
projectRouter.get(
	"/:projectId/members",
	auth(),
	validateRequest(ProjectValidation.projectQuerySchema, "query"),
	ProjectController.getProjectMembers,
);
projectRouter.delete(
	"/:projectId/members/:userId",
	auth(),
	ProjectController.removeProjectMember,
);

export const OrganizationProjectRoutes = organizationProjectRouter;
export const ProjectRoutes = projectRouter;
