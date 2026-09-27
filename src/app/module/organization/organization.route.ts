import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OrganizationLabelRoutes } from "../label/label.route";
import { OrganizationMemberRoutes } from "../organization-member/organization-member.route";
import { OrganizationProjectRoutes } from "../project/project.route";
import { OrganizationTeamRoutes } from "../team/team.route";
import { OrganizationController } from "./organization.controller";
import { OrganizationValidation } from "./organization.validation";

const router = Router();

router.post(
	"/",
	auth(),
	validateRequest(OrganizationValidation.createOrganizationSchema),
	OrganizationController.createOrganization,
);

router.get("/", auth(), OrganizationController.getMyOrganizations);

router.use("/:organizationId/members", OrganizationMemberRoutes);
router.use("/:organizationId/teams", OrganizationTeamRoutes);
router.use("/:organizationId/projects", OrganizationProjectRoutes);
router.use("/:organizationId/labels", OrganizationLabelRoutes);

router.get("/:organizationId", auth(), OrganizationController.getOrganization);

router.patch(
	"/:organizationId",
	auth(),
	validateRequest(OrganizationValidation.updateOrganizationSchema),
	OrganizationController.updateOrganization,
);

router.delete(
	"/:organizationId",
	auth(),
	OrganizationController.deleteOrganization,
);

export const OrganizationRoutes = router;
