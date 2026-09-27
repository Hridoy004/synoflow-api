import httpStatus from "http-status";
import {
	ActivityAction,
	ActivityEntity,
	OrganizationRole,
	OrganizationStatus,
	PaymentStatus,
	SubscriptionPlan,
	SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { createActivity } from "../activity/activity.service";
import { getPlanLimits } from "./config/plan.config";
import type {
	ICreateSubscriptionPayload,
	ISubscriptionSummary,
	IUpdateSubscriptionPayload,
} from "./subscription.interface";

const subscriptionSelect = {
	id: true,
	organizationId: true,
	plan: true,
	status: true,
	currentPeriodStart: true,
	currentPeriodEnd: true,
	cancelAtPeriodEnd: true,
	createdAt: true,
	updatedAt: true,
} as const;

const serializeSubscription = <T extends { plan: SubscriptionPlan }>(
	subscription: T,
) => ({ ...subscription, limits: getPlanLimits(subscription.plan) });

const getActiveOrganization = async (organizationId: string) => {
	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
			status: OrganizationStatus.ACTIVE,
			deletedAt: null,
		},
		select: { id: true },
	});

	if (!organization) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found.");
	}

	return organization;
};

const getOrganizationMembership = async (
	organizationId: string,
	userId: string,
) => {
	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId,
			userId,
			organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
		},
		select: { role: true },
	});

	if (!membership) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not a member of this organization.",
		);
	}

	return membership;
};

const assertOwner = async (organizationId: string, userId: string) => {
	const membership = await getOrganizationMembership(organizationId, userId);

	if (membership.role !== OrganizationRole.OWNER) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only the organization owner can manage the subscription.",
		);
	}
};

const getSubscriptionRecord = async (organizationId: string) => {
	const subscription = await prisma.subscription.findUnique({
		where: { organizationId },
		select: subscriptionSelect,
	});

	if (!subscription) {
		throw new AppError(httpStatus.NOT_FOUND, "Subscription not found.");
	}

	return subscription;
};

const getSubscription = async (
	organizationId: string,
	userId: string,
): Promise<ISubscriptionSummary> => {
	await getActiveOrganization(organizationId);
	await getOrganizationMembership(organizationId, userId);

	const subscription = await getSubscriptionRecord(organizationId);
	return serializeSubscription(subscription);
};

const createSubscription = async (
	organizationId: string,
	userId: string,
	payload: ICreateSubscriptionPayload,
) => {
	await getActiveOrganization(organizationId);
	await assertOwner(organizationId, userId);

	const plan = payload.plan ?? SubscriptionPlan.FREE;
	const isFreePlan = plan === SubscriptionPlan.FREE;

	// Transaction: prevents two simultaneous requests from both passing the
	// "does a subscription already exist" check and both inserting one.
	const subscription = await prisma.$transaction(async (tx) => {
		const existing = await tx.subscription.findUnique({
			where: { organizationId },
			select: { id: true },
		});

		if (existing) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Subscription already exists for this organization.",
			);
		}

		const created = await tx.subscription.create({
			data: {
				organizationId,
				plan,
				status: isFreePlan
					? SubscriptionStatus.ACTIVE
					: SubscriptionStatus.PENDING,
				currentPeriodStart: isFreePlan ? new Date() : null,
				currentPeriodEnd: null,
				cancelAtPeriodEnd: false,
			},
			select: subscriptionSelect,
		});

		await createActivity(
			{
				organizationId,
				userId,
				entityType: ActivityEntity.SUBSCRIPTION,
				entityId: created.id,
				action: ActivityAction.CREATE,
				metadata: { plan: created.plan, status: created.status },
			},
			tx, // createActivity needs to accept + use this, see MIGRATION_NOTES.md
		);

		return created;
	});

	return serializeSubscription(subscription);
};

const updateSubscription = async (
	organizationId: string,
	userId: string,
	payload: IUpdateSubscriptionPayload,
) => {
	await getActiveOrganization(organizationId);
	await assertOwner(organizationId, userId);

	const currentSubscription = await getSubscriptionRecord(organizationId);

	if (
		currentSubscription.status === SubscriptionStatus.CANCELLED ||
		currentSubscription.status === SubscriptionStatus.EXPIRED
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This subscription cannot be updated in its current state.",
		);
	}

	const updatedSubscription = await prisma.$transaction(async (tx) => {
		const updated = await tx.subscription.update({
			where: { organizationId },
			data: {
				...(payload.plan ? { plan: payload.plan } : {}),
				...(payload.cancelAtPeriodEnd !== undefined
					? { cancelAtPeriodEnd: payload.cancelAtPeriodEnd }
					: {}),
			},
			select: subscriptionSelect,
		});

		await createActivity(
			{
				organizationId,
				userId,
				entityType: ActivityEntity.SUBSCRIPTION,
				entityId: updated.id,
				action: ActivityAction.UPDATE,
				metadata: {
					previousPlan: currentSubscription.plan,
					nextPlan: updated.plan,
					cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
				},
			},
			tx,
		);

		return updated;
	});

	return serializeSubscription(updatedSubscription);
};

const cancelSubscription = async (organizationId: string, userId: string) => {
	await getActiveOrganization(organizationId);
	await assertOwner(organizationId, userId);

	const subscription = await getSubscriptionRecord(organizationId);

	if (subscription.status === SubscriptionStatus.CANCELLED) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This subscription is already cancelled.",
		);
	}

	if (subscription.cancelAtPeriodEnd) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cancellation is already scheduled for this subscription.",
		);
	}

	const updatedSubscription = await prisma.$transaction(async (tx) => {
		const updated = await tx.subscription.update({
			where: { organizationId },
			data: { cancelAtPeriodEnd: true },
			select: subscriptionSelect,
		});

		await createActivity(
			{
				organizationId,
				userId,
				entityType: ActivityEntity.SUBSCRIPTION,
				entityId: updated.id,
				action: ActivityAction.UPDATE,
				metadata: { cancelAtPeriodEnd: true, status: updated.status },
			},
			tx,
		);

		return updated;
	});

	return serializeSubscription(updatedSubscription);
};

// Webhook can deliver the same event twice — `processedAt` (new column,
// see MIGRATION_NOTES.md) is claimed with a conditional update so only the
// first delivery actually activates the subscription.
const activatePaidSubscriptionForPayment = async (paymentId: string) => {
	return prisma.$transaction(async (tx) => {
		const payment = await tx.payment.findUnique({
			where: { id: paymentId },
			select: {
				id: true,
				organizationId: true,
				userId: true,
				status: true,
				metadata: true,
				processedAt: true,
			},
		});

		if (!payment) {
			throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
		}

		const metadata = payment.metadata as Record<string, unknown> | null;
		const plan = metadata?.plan as SubscriptionPlan | undefined;

		if (
			payment.status !== PaymentStatus.SUCCESS ||
			!plan ||
			plan === SubscriptionPlan.FREE
		) {
			return { result: "not_processed" } as const;
		}

		if (payment.processedAt) {
			return { result: "already_processed" } as const;
		}

		const claim = await tx.payment.updateMany({
			where: { id: paymentId, processedAt: null },
			data: { processedAt: new Date() },
		});

		if (claim.count === 0) {
			return { result: "already_processed" } as const;
		}

		const currentSubscription = await tx.subscription.findUnique({
			where: { organizationId: payment.organizationId },
			select: { id: true, plan: true, status: true, currentPeriodEnd: true },
		});

		const currentPeriodStart =
			currentSubscription?.currentPeriodEnd ?? new Date();
		const currentPeriodEnd = new Date(currentPeriodStart);
		currentPeriodEnd.setUTCMonth(currentPeriodEnd.getUTCMonth() + 1);

		const subscription = currentSubscription
			? await tx.subscription.update({
					where: { id: currentSubscription.id },
					data: {
						plan,
						status: SubscriptionStatus.ACTIVE,
						currentPeriodStart,
						currentPeriodEnd,
						cancelAtPeriodEnd: false,
					},
				})
			: await tx.subscription.create({
					data: {
						organizationId: payment.organizationId,
						plan,
						status: SubscriptionStatus.ACTIVE,
						currentPeriodStart,
						currentPeriodEnd,
						cancelAtPeriodEnd: false,
					},
				});

		await createActivity(
			{
				organizationId: payment.organizationId,
				userId: payment.userId,
				entityType: ActivityEntity.SUBSCRIPTION,
				entityId: subscription.id,
				action: currentSubscription
					? ActivityAction.UPDATE
					: ActivityAction.CREATE,
				metadata: {
					paymentId: payment.id,
					paymentActivation: true,
					plan: subscription.plan,
					currentPeriodStart: currentPeriodStart.toISOString(),
					currentPeriodEnd: currentPeriodEnd.toISOString(),
				},
			},
			tx,
		);

		return {
			result: "processed" as const,
			subscriptionId: subscription.id,
			currentPeriodStart: subscription.currentPeriodStart,
			currentPeriodEnd: subscription.currentPeriodEnd,
		};
	});
};

export const SubscriptionServices = {
	getSubscription,
	createSubscription,
	updateSubscription,
	cancelSubscription,
	activatePaidSubscriptionForPayment,
};
