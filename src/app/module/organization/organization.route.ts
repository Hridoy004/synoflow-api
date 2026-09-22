import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
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

router.get(
	"/:organizationId",
	auth(),
	validateRequest(OrganizationValidation.organizationIdParamsSchema, "params"),
	OrganizationController.getOrganization,
);

router.patch(
	"/:organizationId",
	auth(),
	validateRequest(OrganizationValidation.organizationIdParamsSchema, "params"),
	validateRequest(OrganizationValidation.updateOrganizationSchema),
	OrganizationController.updateOrganization,
);

router.delete(
	"/:organizationId",
	auth(),
	validateRequest(OrganizationValidation.organizationIdParamsSchema, "params"),
	OrganizationController.deleteOrganization,
);

export const OrganizationRoutes = router;
