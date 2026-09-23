import z from "zod";

const slugSchema = z
	.string()
	.trim()
	.min(1, "Slug is required")
	.max(100, "Slug must not exceed 100 characters.")
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		"Slug must contain lowercase letters, numbers, and hyphens only.",
	);

const createOrganizationSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(2, "Organization name must be at least 2 characters long.")
			.max(150, "Organization name must not exceed 150 characters."),
		slug: slugSchema,
		description: z
			.string()
			.trim()
			.max(500, "Description must not exceed 500 characters.")
			.optional(),
	})
	.strict();

const updateOrganizationSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(2, "Organization name must be at least 2 characters long.")
			.max(150, "Organization name must not exceed 150 characters.")
			.optional(),
		slug: slugSchema.optional(),
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

export const OrganizationValidation = {
	createOrganizationSchema,
	updateOrganizationSchema,
};
