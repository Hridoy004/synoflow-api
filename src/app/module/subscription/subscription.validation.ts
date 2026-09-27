import z from "zod";
import { SubscriptionPlan } from "../../../generated/prisma/enums";

const createSubscriptionSchema = z
	.object({
		plan: z.nativeEnum(SubscriptionPlan).default(SubscriptionPlan.FREE),
	})
	.strict();

const updateSubscriptionSchema = z
	.object({
		plan: z.nativeEnum(SubscriptionPlan).optional(),
		cancelAtPeriodEnd: z.boolean().optional(),
	})
	.strict();

const cancelSubscriptionSchema = z.object({}).strict();

export const SubscriptionValidation = {
	createSubscriptionSchema,
	updateSubscriptionSchema,
	cancelSubscriptionSchema,
};
