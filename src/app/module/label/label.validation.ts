import z from "zod";

const uuid = z.uuid("Invalid ID.");

const labelFields = {
	name: z.string().trim().min(1).max(100),
	color: z
		.string()
		.trim()
		.regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Color must be a hex color.")
		.nullable()
		.optional(),
};

const createLabelSchema = z
	.object({
		name: labelFields.name,
		color: labelFields.color,
	})
	.strict();

const updateLabelSchema = z
	.object({
		name: labelFields.name.optional(),
		color: labelFields.color,
	})
	.strict()
	.refine((payload) => Object.keys(payload).length > 0, {
		message: "At least one field is required for update.",
	});

const attachLabelSchema = z.object({ labelId: uuid }).strict();

const labelQuerySchema = z
	.object({
		page: z.coerce.number().int().positive().default(1),
		limit: z.coerce.number().int().positive().max(100).default(20),
		search: z.string().trim().max(100).optional(),
		sortBy: z
			.enum(["name", "createdAt", "updatedAt"])
			.optional()
			.default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
	})
	.strict();

export const LabelValidation = {
	createLabelSchema,
	updateLabelSchema,
	attachLabelSchema,
	labelQuerySchema,
	organizationLabelParams: z.object({ organizationId: uuid }).strict(),
	taskIdParams: z.object({ taskId: uuid }).strict(),
	labelIdParams: z.object({ labelId: uuid }).strict(),
	taskLabelParams: z.object({ taskId: uuid, labelId: uuid }).strict(),
	taskLabelBody: z.object({ labelId: uuid }).strict(),
};
