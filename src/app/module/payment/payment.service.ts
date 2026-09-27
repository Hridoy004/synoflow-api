import httpStatus from "http-status";
import { randomUUID } from "node:crypto";
import {
	OrganizationRole,
	PaymentProvider,
	PaymentStatus,
	type SubscriptionPlan,
} from "../../../generated/prisma/enums";
import config from "../../config";
import type { IQuery } from "../../interfaces";
import { createBkashPayment } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { getPlanPrice } from "../subscription/config/plan.config";
import type { ICreateSubscriptionRenewalPaymentPayload } from "./payment.interface";

const paymentInclude = {
	organization: { select: { id: true, name: true, slug: true } },
	subscription: { select: { id: true, plan: true, status: true } },
} as const;

const buildCallbackUrl = () => config.bkash_callback_url;

const assertMembership = async (organizationId: string, userId: string) => {
	const membership = await prisma.organizationMember.findFirst({
		where: { organizationId, userId },
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
	const membership = await assertMembership(organizationId, userId);

	if (membership.role !== OrganizationRole.OWNER) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only the organization owner can manage billing.",
		);
	}
};

const getOrganizationPayments = async (
	organizationId: string,
	userId: string,
	query: IQuery,
) => {
	await assertMembership(organizationId, userId);

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const where = { organizationId };

	const [data, total] = await Promise.all([
		prisma.payment.findMany({
			where,
			take: limit,
			skip,
			orderBy: { [sortBy]: sortOrder },
			include: paymentInclude,
		}),
		prisma.payment.count({ where }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

// Platform-wide listing — access is restricted at the route level
// (auth(SystemRole.ADMIN, SystemRole.SUPER_ADMIN)), not here.
const getAllPayments = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const [data, total] = await Promise.all([
		prisma.payment.findMany({
			take: limit,
			skip,
			orderBy: { [sortBy]: sortOrder },
			include: paymentInclude,
		}),
		prisma.payment.count(),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getSinglePayment = async (paymentId: string, user: RequestUser) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: paymentInclude,
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
	}

	await assertMembership(payment.organizationId, user.userId);

	return payment;
};

/**
 * Starts a bKash checkout for a new or upgraded paid subscription. Creates
 * a PENDING Payment row, asks bKash for a redirect URL, and stores it. The
 * organization's subscription only becomes ACTIVE once the bKash callback
 * confirms the payment (see payment-webhook.service.ts).
 */
const createCheckoutPayment = async (
	organizationId: string,
	userId: string,
	plan: SubscriptionPlan,
) => {
	await assertOwner(organizationId, userId);

	const amount = getPlanPrice(plan);
	if (amount <= 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"This plan does not require payment.",
		);
	}

	const transactionId = `chk_${randomUUID()}`;

	const payment = await prisma.payment.create({
		data: {
			organizationId,
			userId,
			provider: PaymentProvider.BKASH,
			transactionId,
			amount,
			currency: "BDT",
			status: PaymentStatus.PENDING,
			metadata: { type: "subscription_checkout", plan, organizationId },
		},
	});

	const { paymentID, bkashURL } = await createBkashPayment({
		amount,
		merchantInvoiceNumber: transactionId,
		callbackURL: buildCallbackUrl(),
	});

	return prisma.payment.update({
		where: { id: payment.id },
		data: { providerSessionId: paymentID, paymentUrl: bkashURL },
	});
};

/**
 * Called by SubscriptionRenewalService for an existing paid subscription
 * whose period has ended. Tagged as a renewal so the webhook rolls the
 * billing period forward instead of activating a brand-new subscription.
 */
const createSubscriptionRenewalPayment = async (
	payload: ICreateSubscriptionRenewalPaymentPayload,
) => {
	const transactionId = `renew_${randomUUID()}`;

	const payment = await prisma.payment.create({
		data: {
			organizationId: payload.organizationId,
			userId: payload.userId,
			subscriptionId: payload.subscriptionId,
			provider: PaymentProvider.BKASH,
			transactionId,
			amount: payload.amount,
			currency: "BDT",
			status: PaymentStatus.PENDING,
			metadata: {
				type: "subscription_renewal",
				plan: payload.plan,
				subscriptionId: payload.subscriptionId,
				billingPeriodEnd: payload.billingPeriodEnd,
			},
		},
	});

	const { paymentID, bkashURL } = await createBkashPayment({
		amount: payload.amount,
		merchantInvoiceNumber: transactionId,
		callbackURL: buildCallbackUrl(),
	});

	return prisma.payment.update({
		where: { id: payment.id },
		data: { providerSessionId: paymentID, paymentUrl: bkashURL },
	});
};

export const PaymentServices = {
	getOrganizationPayments,
	getAllPayments,
	getSinglePayment,
	createCheckoutPayment,
	createSubscriptionRenewalPayment,
};
