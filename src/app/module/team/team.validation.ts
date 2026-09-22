import z from "zod";

const uuid = z.uuid("Invalid ID.");

const createTeamSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Team name must be at least 2 characters long.")
      .max(150, "Team name must not exceed 150 characters."),
    description: z
      .string()
      .trim()
      .max(500, "Description must not exceed 500 characters.")
      .optional(),
  })
  .strict();

const updateTeamSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Team name must be at least 2 characters long.")
      .max(150, "Team name must not exceed 150 characters.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "Description must not exceed 500 characters.")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required for update.",
  });

const addTeamMemberSchema = z.object({ userId: uuid }).strict();

export const TeamValidation = {
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
};
