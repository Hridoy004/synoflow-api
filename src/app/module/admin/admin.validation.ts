import { z } from "zod";
import { SystemRole } from "../../../generated/prisma/enums";

const updateUserRoleSchema = z.object({
  systemRole: z.enum(
    [SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN],
    {
      error: "systemRole must be USER, ADMIN, or SUPER_ADMIN",
    },
  ),
});

export const AdminValidation = {
  updateUserRoleSchema,
};
