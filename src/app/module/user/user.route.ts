import { Router } from "express";
import { SystemRole } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

router.patch(
  "/me",
  auth(),
  validateRequest(UserValidation.updateMyProfileSchema),
  UserController.updateMyProfile,
);

router.patch(
  "/profile-image",
  auth(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.USER),
  upload.single("profileImage"),
  UserController.uploadProfileImage,
);

export const UserRoutes = router;
