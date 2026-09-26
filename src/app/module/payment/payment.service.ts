import httpStatus from "http-status";
import { randomUUID } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import {
  OrganizationRole,
  OrganizationStatus,
  PaymentProvider,
  PaymentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { SubscriptionServices } from "../subscription/subscription.service";
import { PaymentStatementService } from "./payment-statement.service";

const PLAN_PRICE_BY_PLAN: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.PRO]: 49,
  [SubscriptionPlan.BUSINESS]: 99,
};

const paymentSelect = {
  id: true,
  organizationId: true,
  subscriptionId: true,
  userId: true,
  provider: true,
  transactionId: true,
  providerSessionId: true,
  providerTransactionId: true,
  amount: true,
  currency: true,
  status: true,
  paymentUrl: true,
  paidAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

const getOrganizationMembership = async (
  organizationId: string,
  userId: string,
) => {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      organization: {
        status: OrganizationStatus.ACTIVE,
        deletedAt: null,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Subscription not found or organization access was denied.",
    );
  }

  return membership;
};

const assertOwnerForPayment = async (
  organizationId: string,
  userId: string,
) => {
  const membership = await getOrganizationMembership(organizationId, userId);

  if (membership.role !== OrganizationRole.OWNER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the organization owner can manage billing.",
    );
  }
};

const getOrganizationRecord = async (organizationId: string) => {
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

const getPlanPrice = (plan: SubscriptionPlan) => PLAN_PRICE_BY_PLAN[plan] ?? 0;

const isCheckoutEligibleForSubscription = (subscription: {
  plan?: SubscriptionPlan | string;
  status?: SubscriptionStatus | string;
}) => {
  if (!subscription) {
    return false;
  }

  const plan = String(subscription.plan ?? "");
  const status = String(subscription.status ?? "");

  if (plan === SubscriptionPlan.FREE) {
    return false;
  }

  return (
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.PAST_DUE
  );
};

const resolvePaymentStatus = (status: string) => {
  if (status === "SUCCESS") return PaymentStatus.SUCCESS;
  if (status === "FAILED") return PaymentStatus.FAILED;
  if (status === "CANCELLED") return PaymentStatus.CANCELLED;
  if (status === "PENDING") return PaymentStatus.PENDING;
  return null;
};

const createBkashCheckoutSession = async ({
  paymentId,
  subscriptionId,
  organizationId,
  amount,
  currency,
}: {
  paymentId: string;
  subscriptionId: string;
  organizationId: string;
  amount: number;
  currency: string;
}) => {
  if (
    !config.bkash_base_url ||
    !config.bkash_app_key ||
    !config.bkash_app_secret
  ) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Bkash payment provider is not configured.",
    );
  }

  const idToken = await getBkashIdToken();
  const callbackUrl =
    config.bkash_callback_url ||
    `${config.bak_url ?? config.frontend_url ?? "http://localhost:3000"}/api/v1/payments/webhook`;

  const providerResponse = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: Number(amount).toFixed(2),
        currency,
        intent: "sale",
        merchantInvoiceNumber: paymentId,
        payerReference: organizationId,
        callbackURL: callbackUrl,
        metadata: {
          paymentId,
          subscriptionId,
          organizationId,
        },
      }),
    },
  );

  const providerPayload = await providerResponse.json().catch(() => ({}));

  if (!providerResponse.ok) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Payment provider checkout creation failed.",
    );
  }

  const checkoutUrl =
    providerPayload.bkashURL ??
    providerPayload.paymentUrl ??
    providerPayload.checkoutUrl ??
    providerPayload.redirectUrl ??
    null;

  if (!checkoutUrl) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Payment provider did not return a checkout URL.",
    );
  }

  return {
    providerSessionId:
      providerPayload.checkoutId ??
      providerPayload.paymentId ??
      providerPayload.id ??
      null,
    providerTransactionId:
      providerPayload.transactionId ??
      providerPayload.trxId ??
      providerPayload.paymentReference ??
      null,
    checkoutUrl,
  };
};

const createCheckout = async (userId: string, subscriptionId: string) => {
  const subscription = await prisma.subscription.findUnique({
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

  await getOrganizationRecord(subscription.organizationId);
  await assertOwnerForPayment(subscription.organizationId, userId);

  if (!isCheckoutEligibleForSubscription(subscription)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This subscription is not eligible for checkout.",
    );
  }

  const amount = getPlanPrice(subscription.plan);

  if (amount <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A paid subscription is required before checkout can begin.",
    );
  }

  const billingPeriodKey =
    subscription.currentPeriodEnd?.toISOString() ??
    subscription.currentPeriodStart?.toISOString() ??
    new Date().toISOString();

  const duplicatePayment = await prisma.payment.findFirst({
    where: {
      organizationId: subscription.organizationId,
      subscriptionId: subscription.id,
      status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] },
      metadata: {
        path: ["billingPeriodKey"],
        equals: billingPeriodKey,
      },
    },
    select: paymentSelect,
  });

  if (duplicatePayment) {
    if (duplicatePayment.status === PaymentStatus.SUCCESS) {
      throw new AppError(
        httpStatus.CONFLICT,
        "A payment has already been completed for this billing period.",
      );
    }

    return {
      paymentId: duplicatePayment.id,
      subscriptionId: duplicatePayment.subscriptionId ?? subscription.id,
      amount: Number(duplicatePayment.amount),
      currency: duplicatePayment.currency,
      status: duplicatePayment.status,
      checkoutUrl: duplicatePayment.paymentUrl ?? null,
    };
  }

  const pendingPayment = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: {
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        status: PaymentStatus.PENDING,
        metadata: {
          path: ["billingPeriodKey"],
          equals: billingPeriodKey,
        },
      },
      select: paymentSelect,
    });

    if (existing) {
      return existing;
    }

    return tx.payment.create({
      data: {
        organizationId: subscription.organizationId,
        subscriptionId: subscription.id,
        userId,
        provider: PaymentProvider.BKASH,
        transactionId: randomUUID(),
        amount: new Prisma.Decimal(amount.toFixed(2)),
        currency: "BDT",
        status: PaymentStatus.PENDING,
        paymentUrl: null,
        metadata: {
          type: "subscription_checkout",
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          userId,
          plan: subscription.plan,
          billingPeriodKey,
        },
      },
      select: paymentSelect,
    });
  });

  const checkoutSession = await createBkashCheckoutSession({
    paymentId: pendingPayment.id,
    subscriptionId: subscription.id,
    organizationId: subscription.organizationId,
    amount,
    currency: pendingPayment.currency,
  });

  const updatedPayment = await prisma.payment.update({
    where: { id: pendingPayment.id },
    data: {
      provider: PaymentProvider.BKASH,
      providerSessionId: checkoutSession.providerSessionId ?? undefined,
      providerTransactionId: checkoutSession.providerTransactionId ?? undefined,
      paymentUrl: checkoutSession.checkoutUrl,
      metadata: {
        ...(pendingPayment.metadata as Record<string, unknown> | null),
        providerSessionId: checkoutSession.providerSessionId,
        providerTransactionId: checkoutSession.providerTransactionId,
        checkoutUrl: checkoutSession.checkoutUrl,
      },
    },
    select: paymentSelect,
  });

  return {
    paymentId: updatedPayment.id,
    subscriptionId: updatedPayment.subscriptionId ?? subscription.id,
    amount: Number(updatedPayment.amount),
    currency: updatedPayment.currency,
    status: updatedPayment.status,
    checkoutUrl: updatedPayment.paymentUrl ?? null,
  };
};

const getPayments = async (organizationId: string, userId: string) => {
  await getOrganizationRecord(organizationId);
  await getOrganizationMembership(organizationId, userId);

  return prisma.payment.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: paymentSelect,
  });
};

const getPayment = async (paymentId: string, userId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      ...paymentSelect,
      organization: {
        select: { id: true },
      },
    },
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
  }

  await getOrganizationMembership(payment.organizationId, userId);

  return payment;
};

const createSubscriptionRenewalPayment = async ({
  organizationId,
  userId,
  plan,
  subscriptionId,
  amount,
  billingPeriodEnd,
}: {
  organizationId: string;
  userId: string;
  plan: SubscriptionPlan;
  subscriptionId: string;
  amount: number;
  billingPeriodEnd: string;
}) => {
  const payments = await prisma.payment.findMany({
    where: {
      organizationId,
      userId,
      status: {
        in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS],
      },
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  const match = payments.find((payment) => {
    const metadata = payment.metadata as Record<string, unknown> | null;
    return (
      metadata?.type === "subscription_renewal" &&
      metadata?.subscriptionId === subscriptionId &&
      metadata?.billingPeriodEnd === billingPeriodEnd
    );
  });

  if (match) {
    return prisma.payment.findUnique({
      where: { id: match.id },
      select: paymentSelect,
    });
  }

  return prisma.payment.create({
    data: {
      organizationId,
      subscriptionId,
      userId,
      provider: PaymentProvider.BKASH,
      transactionId: randomUUID(),
      amount: new Prisma.Decimal(amount.toFixed(2)),
      currency: "BDT",
      status: PaymentStatus.PENDING,
      paymentUrl: null,
      metadata: {
        type: "subscription_renewal",
        organizationId,
        userId,
        plan,
        subscriptionId,
        billingPeriodEnd,
      },
    },
    select: paymentSelect,
  });
};

const processWebhook = async (payload: {
  paymentId?: string;
  subscriptionId?: string;
  organizationId?: string;
  providerTransactionId?: string;
  status: PaymentStatus | string;
  paymentUrl?: string | null;
}) => {
  const normalizedStatus = resolvePaymentStatus(String(payload.status));

  if (!normalizedStatus) {
    throw new AppError(httpStatus.BAD_REQUEST, "Unsupported payment status.");
  }

  const payment = payload.paymentId
    ? await prisma.payment.findUnique({
        where: { id: payload.paymentId },
        select: paymentSelect,
      })
    : payload.providerTransactionId
      ? await prisma.payment.findFirst({
          where: { providerTransactionId: payload.providerTransactionId },
          select: paymentSelect,
        })
      : payload.subscriptionId && payload.organizationId
        ? await prisma.payment.findFirst({
            where: {
              subscriptionId: payload.subscriptionId,
              organizationId: payload.organizationId,
              status: {
                in: [
                  PaymentStatus.PENDING,
                  PaymentStatus.SUCCESS,
                  PaymentStatus.FAILED,
                ],
              },
            },
            select: paymentSelect,
          })
        : null;

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
  }

  if (
    payment.status === PaymentStatus.SUCCESS &&
    normalizedStatus === PaymentStatus.SUCCESS
  ) {
    return payment;
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: normalizedStatus,
      paymentUrl: payload.paymentUrl ?? payment.paymentUrl,
      providerTransactionId:
        payload.providerTransactionId ?? payment.providerTransactionId,
      paidAt:
        normalizedStatus === PaymentStatus.SUCCESS
          ? (payment.paidAt ?? new Date())
          : payment.paidAt,
    },
    select: paymentSelect,
  });

  if (updatedPayment.status === PaymentStatus.SUCCESS) {
    await SubscriptionServices.activatePaidSubscriptionForPayment(
      updatedPayment.id,
    );

    try {
      await PaymentStatementService.sendPaymentStatement(updatedPayment.id);
    } catch (error) {
      console.error("Payment statement email failed", {
        paymentId: updatedPayment.id,
        error,
      });
    }
  }

  return updatedPayment;
};

export const PaymentServices = {
  getPlanPrice,
  isCheckoutEligibleForSubscription,
  createCheckout,
  checkout: createCheckout,
  getPayments,
  getPayment,
  createSubscriptionRenewalPayment,
  processWebhook,
};
