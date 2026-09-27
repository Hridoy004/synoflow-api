import type { SubscriptionPlan } from "../../../generated/prisma/enums";

export interface ICreateCheckoutPayload {
	plan: SubscriptionPlan;
}

export interface ICreateSubscriptionRenewalPaymentPayload {
	organizationId: string;
	userId: string;
	plan: SubscriptionPlan;
	subscriptionId: string;
	amount: number;
	billingPeriodEnd: string;
}
