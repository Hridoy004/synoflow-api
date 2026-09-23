import z from "zod";

const uuid = z.uuid("Invalid ID.");
const date = z.coerce.date();
const projectQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().max(100).optional(),
});

const projectFields = {
  name: z.string().trim().min(2).max(150),
  key: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Project key contains invalid characters."),
  description: z.string().trim().max(500).nullable().optional(),
  teamId: uuid.nullable().optional(),
  startDate: date.nullable().optional(),
  dueDate: date.nullable().optional(),
};

const validateDates = (payload: {
  startDate?: Date | null;
  dueDate?: Date | null;
}) =>
  !payload.startDate ||
  !payload.dueDate ||
  payload.startDate <= payload.dueDate;

const createProjectSchema = z
  .object(projectFields)
  .strict()
  .refine(validateDates, {
    message: "Project due date must be on or after its start date.",
  });

const updateProjectSchema = z
  .object({
    name: projectFields.name.optional(),
    key: projectFields.key.optional(),
    description: projectFields.description,
    teamId: projectFields.teamId,
    startDate: projectFields.startDate,
    dueDate: projectFields.dueDate,
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required for update.",
  })
  .refine(validateDates, {
    message: "Project due date must be on or after its start date.",
  });

export const ProjectValidation = {
  projectQuerySchema,
  createProjectSchema,
  updateProjectSchema,
  projectMemberSchema: z.object({ userId: uuid }).strict(),
};
