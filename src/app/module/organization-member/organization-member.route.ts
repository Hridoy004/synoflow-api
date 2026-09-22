import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OrganizationMemberController } from "./organization-member.controller";
import { OrganizationMemberValidation } from "./organization-member.validation";

const router = Router({ mergeParams: true });

router.post(
  "/",
  auth(),
  validateRequest(OrganizationMemberValidation.addOrganizationMemberSchema),
  OrganizationMemberController.addMember,
);

router.get("/", auth(), OrganizationMemberController.getMembers);

router.patch(
  "/:memberId",
  auth(),
  validateRequest(OrganizationMemberValidation.updateOrganizationMemberSchema),
  OrganizationMemberController.updateMember,
);

router.delete("/:memberId", auth(), OrganizationMemberController.removeMember);

router.post(
  "/invite",
  auth(),
  validateRequest(OrganizationMemberValidation.inviteOrganizationMemberSchema),
  OrganizationMemberController.inviteMember,
);

router.post(
  "/accept",
  auth(),
  validateRequest(
    OrganizationMemberValidation.acceptOrganizationInvitationSchema,
  ),
  OrganizationMemberController.acceptInvitation,
);

export const OrganizationMemberRoutes = router;
