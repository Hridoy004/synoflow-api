import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TeamController } from "./team.controller";
import { TeamValidation } from "./team.validation";

const organizationTeamRouter = Router({ mergeParams: true });

organizationTeamRouter.post(
	"/",
	auth(),
	validateRequest(TeamValidation.createTeamSchema),
	TeamController.createTeam,
);

organizationTeamRouter.get("/", auth(), TeamController.getOrganizationTeams);

const teamRouter = Router();

teamRouter.get("/:teamId", auth(), TeamController.getTeam);

teamRouter.patch(
	"/:teamId",
	auth(),
	validateRequest(TeamValidation.updateTeamSchema),
	TeamController.updateTeam,
);

teamRouter.delete("/:teamId", auth(), TeamController.deleteTeam);

teamRouter.post(
	"/:teamId/members",
	auth(),
	validateRequest(TeamValidation.addTeamMemberSchema),
	TeamController.addTeamMember,
);

teamRouter.get("/:teamId/members", auth(), TeamController.getTeamMembers);

teamRouter.delete(
	"/:teamId/members/:userId",
	auth(),
	TeamController.removeTeamMember,
);

export const OrganizationTeamRoutes = organizationTeamRouter;
export const TeamRoutes = teamRouter;
