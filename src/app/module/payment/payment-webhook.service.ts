import httpStatus from "http-status";
import {
	ActivityAction,
	ActivityEntity,
	PaymentStatus,
} from "../../../generated/prisma/enums";
import { executeBkashPayment } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { generateInvoicePdf } from "../../utils/generateInvoicePdf";
import { sendMail } from "../../utils/sendMail";
import { createActivity } from "../activity/activity.service";
import { SubscriptionRenewalService } from "../subscription/subscription-renewal.service";
import { SubscriptionServices } from "../subscription/subscription.service";

type BkashCallbackStatus = "success" | "failure" | "cancel";

const markPaymentFailed = async (paymentId: string, reason: string) => {
	await prisma.payment.updateMany({
		where: { id: paymentId, status: PaymentStatus.PENDING },
		data: { status: PaymentStatus.FAILED, metadata: { failReason: reason } },
	});
};

/**
 * Entry point for bKash's redirect after the user completes (or cancels)
 * checkout. Idempotent: a payment that's already out of PENDING is not
 * reprocessed, so a page refresh or a duplicate redirect is harmless.
 */
export const handleBkashCallback = async (
	paymentID: string,
	status: BkashCallbackStatus,
) => {
	const payment = await prisma.payment.findFirst({
		where: { providerSessionId: paymentID },
	});

	if (!payment) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Payment not found for this bKash session.",
		);
	}

	if (payment.status !== PaymentStatus.PENDING) {
		return { result: "already_processed" as const, paymentId: payment.id };
	}

	if (status !== "success") {
		await markPaymentFailed(payment.id, `bkash_status_${status}`);
		return { result: "failed" as const, paymentId: payment.id };
	}

	const execution = await executeBkashPayment(paymentID);

	if (execution.transactionStatus !== "Completed" || !execution.trxID) {
		await markPaymentFailed(
			payment.id,
			execution.statusMessage ?? "execute_failed",
		);
		return { result: "failed" as const, paymentId: payment.id };
	}

	// Claim the row before doing anything else, so two concurrent callback
	// deliveries for the same paymentID can't both proceed.
	const claim = await prisma.payment.updateMany({
		where: { id: payment.id, status: PaymentStatus.PENDING },
		data: {
			status: PaymentStatus.SUCCESS,
			providerTransactionId: execution.trxID,
			paidAt: new Date(),
		},
	});

	if (claim.count === 0) {
		return { result: "already_processed" as const, paymentId: payment.id };
	}

	const metadata = payment.metadata as Record<string, unknown> | null;

	if (metadata?.type === "subscription_renewal") {
		await SubscriptionRenewalService.applySuccessfulRenewal(payment.id);
	} else {
		await SubscriptionServices.activatePaidSubscriptionForPayment(payment.id);
	}

	await createActivity({
		organizationId: payment.organizationId,
		userId: payment.userId,
		entityType: ActivityEntity.PAYMENT,
		entityId: payment.id,
		action: ActivityAction.PAYMENT_SUCCESS,
		metadata: {
			amount: payment.amount.toString(),
			transactionId: execution.trxID,
		},
	});

	// Invoice email is best-effort: the payment is already confirmed and
	// the subscription already activated, so a mail failure here shouldn't
	// surface as a failed payment to the user.
	await sendInvoiceEmail(payment.id).catch((error) => {
		console.error("Failed to send invoice email:", error);
	});

	return { result: "success" as const, paymentId: payment.id };
};

const sendInvoiceEmail = async (paymentId: string) => {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: {
			organization: { select: { name: true } },
			user: { select: { name: true, email: true } },
		},
	});

	if (!payment || !payment.user?.email) return;

	const metadata = payment.metadata as Record<string, unknown> | null;
	const plan = metadata?.plan as InvoicePlan;

	const pdfBuffer = await generateInvoicePdf({
		invoiceNumber: payment.transactionId,
		organizationName: payment.organization.name,
		customerName: payment.user.name ?? payment.user.email,
		plan,
		amount: Number(payment.amount),
		currency: payment.currency,
		paidAt: payment.paidAt ?? new Date(),
		transactionId: payment.providerTransactionId ?? payment.transactionId,
	});

	await sendMail({
		to: payment.user.email,
		subject: `Payment received — Invoice ${payment.transactionId}`,
		text: `Hi ${payment.user.name ?? ""},\n\nThanks for your payment of ${payment.amount} ${payment.currency}. Your invoice is attached.\n\nOrganization: ${payment.organization.name}`,
		attachments: [
			{
				filename: `invoice-${payment.transactionId}.pdf`,
				content: pdfBuffer,
				contentType: "application/pdf",
			},
		],
	});
};

// Kept local to avoid importing the enum just for a type annotation.
type InvoicePlan = Parameters<typeof generateInvoicePdf>[0]["plan"];
