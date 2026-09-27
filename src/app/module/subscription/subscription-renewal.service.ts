import httpStatus from "http-status";
import {
	ActivityAction,
	ActivityEntity,
	PaymentStatus,
	SubscriptionPlan,
	SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { createActivity } from "../activity/activity.service";
import { PaymentServices } from "../payment/payment.service";
import { getPlanPrice } from "./config/plan.config";

export type RenewalCandidate = {
	id: string;
	organizationId: string;
	plan: SubscriptionPlan;
	status: SubscriptionStatus;
	currentPeriodStart: Date | null;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	organization: { id: string; createdById: string };
};

const isUniqueConstraintError = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	(error as { code?: string }).code === "P2002";

export const SubscriptionRenewalService = {
	isRenewalEligible(
		subscription: {
			plan: SubscriptionPlan | string;
			status: SubscriptionStatus | string;
			currentPeriodEnd: Date | null;
			cancelAtPeriodEnd: boolean;
		},
		now: Date = new Date(),
	) {
		if (!subscription || !subscription.currentPeriodEnd) return false;
		if (subscription.plan === SubscriptionPlan.FREE) return false;
		if (subscription.status !== SubscriptionStatus.ACTIVE) return false;
		if (subscription.cancelAtPeriodEnd) return false;

		return new Date(subscription.currentPeriodEnd) <= now;
	},

	calculateNextPeriod(previousPeriodEnd: Date) {
		const start = new Date(previousPeriodEnd);
		const end = new Date(previousPeriodEnd);
		end.setUTCMonth(end.getUTCMonth() + 1);
		return { start, end };
	},

	async findRenewalCandidates(now: Date = new Date()) {
		const subscriptions = await prisma.subscription.findMany({
			where: {
				plan: { in: [SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS] },
				status: SubscriptionStatus.ACTIVE,
				cancelAtPeriodEnd: false,
				currentPeriodEnd: { lte: now },
			},
			select: {
				id: true,
				organizationId: true,
				plan: true,
				status: true,
				currentPeriodStart: true,
				currentPeriodEnd: true,
				cancelAtPeriodEnd: true,
				organization: { select: { id: true, createdById: true } },
			},
		});

		return subscriptions as RenewalCandidate[];
	},

	async processRenewalForSubscription(subscriptionId: string) {
		const subscription = await prisma.subscription.findUnique({
			where: { id: subscriptionId },
			select: {
				id: true,
				organizationId: true,
				plan: true,
				status: true,
				currentPeriodStart: true,
				currentPeriodEnd: true,
				cancelAtPeriodEnd: true,
				organization: { select: { id: true, createdById: true } },
			},
		});

		if (!subscription) {
			throw new AppError(httpStatus.NOT_FOUND, "Subscription not found.");
		}

		if (!SubscriptionRenewalService.isRenewalEligible(subscription)) {
			return { executed: false, reason: "not_due" } as const;
		}

		const periodKey = subscription.currentPeriodEnd?.toISOString();

		const existingPayments = await prisma.payment.findMany({
			where: {
				organizationId: subscription.organizationId,
				status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] },
			},
			select: { id: true, metadata: true },
		});

		const existingRenewal = existingPayments.find((payment) => {
			const metadata = payment.metadata as Record<string, unknown> | null;
			return (
				metadata?.type === "subscription_renewal" &&
				metadata?.subscriptionId === subscription.id &&
				metadata?.billingPeriodEnd === periodKey
			);
		});

		if (existingRenewal) {
			return {
				executed: false,
				reason: "already_in_progress",
				paymentId: existingRenewal.id,
			} as const;
		}

		try {
			const payment = await PaymentServices.createSubscriptionRenewalPayment({
				organizationId: subscription.organizationId,
				userId: subscription.organization.createdById,
				plan: subscription.plan,
				subscriptionId: subscription.id,
				amount: getPlanPrice(subscription.plan),
				billingPeriodEnd: periodKey ?? new Date().toISOString(),
			});

			if (!payment) {
				return { executed: false, reason: "payment_not_created" } as const;
			}

			return {
				executed: true,
				paymentId: payment.id,
				status: payment.status,
			} as const;
		} catch (error) {
			// If createSubscriptionRenewalPayment enforces a DB unique constraint
			// on (subscriptionId, billingPeriodEnd) — see MIGRATION_NOTES.md — a
			// concurrent renewal run for the same period lands here instead of
			// creating a duplicate payment.
			if (isUniqueConstraintError(error)) {
				return { executed: false, reason: "already_in_progress" } as const;
			}
			throw error;
		}
	},

	async processRenewalBatch(now: Date = new Date()) {
		const candidates =
			await SubscriptionRenewalService.findRenewalCandidates(now);

		const results: Array<{
			subscriptionId: string;
			executed: boolean;
			paymentId?: string;
			reason?: string;
			error?: string;
		}> = [];

		for (const candidate of candidates) {
			try {
				const result =
					await SubscriptionRenewalService.processRenewalForSubscription(
						candidate.id,
					);
				results.push({ subscriptionId: candidate.id, ...result });
			} catch (error) {
				// One organization's failure (e.g. gateway timeout) shouldn't stop
				// the rest of the batch from being processed.
				results.push({
					subscriptionId: candidate.id,
					executed: false,
					reason: "error",
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return results;
	},

	async applySuccessfulRenewal(paymentId: string) {
		return prisma.$transaction(async (tx) => {
			const payment = await tx.payment.findUnique({
				where: { id: paymentId },
				select: {
					id: true,
					organizationId: true,
					userId: true,
					status: true,
					metadata: true,
				},
			});

			if (!payment) {
				throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
			}

			if (payment.status !== PaymentStatus.SUCCESS) {
				return { result: "not_processed" } as const;
			}

			const metadata = payment.metadata as Record<string, unknown> | null;
			const subscriptionId = metadata?.subscriptionId as string | undefined;
			const billingPeriodEnd = metadata?.billingPeriodEnd as string | undefined;

			if (!subscriptionId) {
				return { result: "not_subscription_payment" } as const;
			}

			const subscription = await tx.subscription.findUnique({
				where: { id: subscriptionId },
				select: {
					id: true,
					organizationId: true,
					plan: true,
					status: true,
					currentPeriodStart: true,
					currentPeriodEnd: true,
				},
			});

			if (!subscription) {
				throw new AppError(httpStatus.NOT_FOUND, "Subscription not found.");
			}

			if (subscription.status !== SubscriptionStatus.ACTIVE) {
				return { result: "subscription_not_active" } as const;
			}

			// If the period was already rolled forward (e.g. duplicate webhook),
			// don't advance it a second time.
			if (
				billingPeriodEnd &&
				subscription.currentPeriodEnd?.toISOString() !== billingPeriodEnd
			) {
				return { result: "already_processed" } as const;
			}

			const previousPeriodEnd = subscription.currentPeriodEnd ?? new Date();
			const { start, end } =
				SubscriptionRenewalService.calculateNextPeriod(previousPeriodEnd);

			const updatedSubscription = await tx.subscription.update({
				where: { id: subscription.id },
				data: {
					currentPeriodStart: start,
					currentPeriodEnd: end,
					cancelAtPeriodEnd: false,
				},
			});

			await createActivity(
				{
					organizationId: subscription.organizationId,
					userId: payment.userId,
					entityType: ActivityEntity.SUBSCRIPTION,
					entityId: updatedSubscription.id,
					action: ActivityAction.UPDATE,
					metadata: {
						renewal: true,
						previousPeriodEnd:
							billingPeriodEnd ?? previousPeriodEnd.toISOString(),
						nextPeriodStart: start.toISOString(),
						nextPeriodEnd: end.toISOString(),
						plan: updatedSubscription.plan,
					},
				},
				tx,
			);

			return {
				result: "processed" as const,
				subscriptionId: updatedSubscription.id,
				currentPeriodStart: updatedSubscription.currentPeriodStart,
				currentPeriodEnd: updatedSubscription.currentPeriodEnd,
			};
		});
	},
};
