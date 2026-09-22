import z from "zod";

const addOrganizationMemberSchema = z
  .object({
    email: z.string().trim().email("Invalid email address."),
    role: z.literal("MEMBER"),
  })
  .strict();

const updateOrganizationMemberSchema = z
  .object({
    role: z.literal("MEMBER"),
  })
  .strict();

const inviteOrganizationMemberSchema = z
  .object({
    email: z.string().trim().email("Invalid email address."),
  })
  .strict();

const acceptOrganizationInvitationSchema = z
  .object({
    token: z.string().trim().min(1, "Invitation token is required."),
  })
  .strict();

export const OrganizationMemberValidation = {
  addOrganizationMemberSchema,
  updateOrganizationMemberSchema,
  inviteOrganizationMemberSchema,
  acceptOrganizationInvitationSchema,
};
