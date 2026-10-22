import z from "zod";
import { ContactStatus } from "../../../generated/prisma/enums";

const inquiryTypes = [
	"general",
	"support",
	"billing",
	"feature-request",
	"bug-report",
	"partnership",
] as const;

const createContactSchema = z
	.object({
		name: z.string().trim().min(2).max(100),
		email: z.string().trim().min(1).max(254).email(),
		inquiryType: z.enum(inquiryTypes),
		organization: z
			.string()
			.trim()
			.max(120)
			.optional()
			.transform((value) => value || undefined),
		subject: z.string().trim().min(3).max(150),
		message: z.string().trim().min(10).max(2000),
	})
	.strict();

const contactQuerySchema = z
	.object({
		page: z.coerce.number().int().positive().default(1),
		limit: z.coerce.number().int().positive().max(100).default(20),
		status: z.nativeEnum(ContactStatus).optional(),
		inquiryType: z.enum(inquiryTypes).optional(),
		search: z.string().trim().max(254).optional(),
	})
	.strict();

const contactIdParams = z
	.object({ contactId: z.uuid("Invalid contact ID.") })
	.strict();

export type CreateContactInput = z.infer<typeof createContactSchema>;

export const ContactValidation = {
	createContactSchema,
	contactQuerySchema,
	contactIdParams,
};
