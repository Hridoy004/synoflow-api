import z from "zod";

const updateMyProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty.")
      .min(2, "Name must be at least 2 characters long.")
      .max(100, "Name must not exceed 100 characters.")
      .optional(),
  })
  .strict();

export const UserValidation = {
  updateMyProfileSchema,
};
