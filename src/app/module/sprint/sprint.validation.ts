import z from "zod";

const uuid = z.uuid("Invalid ID.");
const date = z.coerce.date();
const sprintQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(10),
});
const sprintFields = {
	name: z.string().trim().min(2).max(150),
	goal: z.string().trim().max(500).nullable().optional(),
	startDate: date.nullable().optional(),
	endDate: date.nullable().optional(),
};
const validDates = (payload: {
	startDate?: Date | null;
	endDate?: Date | null;
}) =>
	!payload.startDate ||
	!payload.endDate ||
	payload.startDate <= payload.endDate;
const createSprintSchema = z.object(sprintFields).strict().refine(validDates, {
	message: "Sprint end date must be on or after its start date.",
});
const updateSprintSchema = z
	.object({
		name: sprintFields.name.optional(),
		goal: sprintFields.goal,
		startDate: sprintFields.startDate,
		endDate: sprintFields.endDate,
	})
	.strict()
	.refine((payload) => Object.keys(payload).length > 0, {
		message: "At least one field is required for update.",
	})
	.refine(validDates, {
		message: "Sprint end date must be on or after its start date.",
	});

export const SprintValidation = {
	sprintQuerySchema,
	createSprintSchema,
	updateSprintSchema,
};
