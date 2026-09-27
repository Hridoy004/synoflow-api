import z from "zod";

const uuid = z.uuid("Invalid ID.");

const attachmentQuerySchema = z
	.object({
		page: z.coerce.number().int().positive().default(1),
		limit: z.coerce.number().int().positive().max(100).default(20),
	})
	.strict();

export const AttachmentValidation = {
	attachmentQuerySchema,
	taskIdParams: z.object({ taskId: uuid }).strict(),
	attachmentIdParams: z.object({ attachmentId: uuid }).strict(),
};
