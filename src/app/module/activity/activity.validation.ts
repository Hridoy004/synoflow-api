import z from "zod";
import {
	ActivityAction,
	ActivityEntity,
} from "../../../generated/prisma/enums";

const activityQuerySchema = z
	.object({
		page: z.coerce.number().int().positive().default(1),
		limit: z.coerce.number().int().positive().max(100).default(20),
		actorId: z.string().uuid().optional(),
		action: z.nativeEnum(ActivityAction).optional(),
		entityType: z.nativeEnum(ActivityEntity).optional(),
		entityId: z.string().uuid().optional(),
	})
	.strict();

export const ActivityValidation = {
	activityQuerySchema,
};
