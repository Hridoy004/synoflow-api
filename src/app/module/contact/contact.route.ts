import { Router } from "express";
import { SystemRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ContactController } from "./contact.controller";
import { ContactValidation } from "./contact.validation";

const router = Router();

router.post(
	"/",
	validateRequest(ContactValidation.createContactSchema),
	ContactController.createContact,
);
router.get(
	"/",
	auth(SystemRole.ADMIN, SystemRole.SUPER_ADMIN),
	validateRequest(ContactValidation.contactQuerySchema, "query"),
	ContactController.getContacts,
);
router.get(
	"/:contactId",
	auth(SystemRole.ADMIN, SystemRole.SUPER_ADMIN),
	validateRequest(ContactValidation.contactIdParams, "params"),
	ContactController.getContactById,
);
router.delete(
	"/:contactId",
	auth(SystemRole.ADMIN, SystemRole.SUPER_ADMIN),
	validateRequest(ContactValidation.contactIdParams, "params"),
	ContactController.deleteContact,
);

export const ContactRoutes = router;
