import httpStatus from "http-status";
import { randomUUID } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client";
import {
  OrganizationRole,
  OrganizationStatus,
  PaymentProvider,
  PaymentStatus,
  SubscriptionPlan,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { SubscriptionRenewalService } from "../subscription/subscription-renewal.service";

const planPriceByPlan: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.PRO]: 49,
  [SubscriptionPlan.BUSINESS]: 99,
};

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
      httpStatus.FORBIDDEN,
      "You are not a member of this organization.",
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
    select: { id: true, createdById: true },
  });

  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, "Organization not found.");
  }

  return organization;
};

const paymentSelect = {
  id: true,
  organizationId: true,
  userId: true,
  provider: true,
  transactionId: true,
  amount: true,
  currency: true,
  status: true,
  paymentUrl: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

const checkout = async (
  organizationId: string,
  userId: string,
  plan: SubscriptionPlan,
) => {
  await getOrganizationRecord(organizationId);
  await assertOwnerForPayment(organizationId, userId);

  if (plan === SubscriptionPlan.FREE) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "A paid plan is required for billing.",
    );
  }

  const amount = planPriceByPlan[plan] ?? 0;

  return prisma.payment.create({
    data: {
      organizationId,
      userId,
      provider: PaymentProvider.STRIPE,
      transactionId: randomUUID(),
      amount: new Prisma.Decimal(amount.toFixed(2)),
      currency: "USD",
      status: PaymentStatus.PENDING,
      paymentUrl: null,
      metadata: {
        type: "subscription_checkout",
        organizationId,
        userId,
        plan,
      },
    },
    select: paymentSelect,
  });
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
      userId,
      provider: PaymentProvider.STRIPE,
      transactionId: randomUUID(),
      amount: new Prisma.Decimal(amount.toFixed(2)),
      currency: "USD",
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
  transactionId: string;
  status: PaymentStatus;
  paymentUrl?: string | null;
}) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionId: payload.transactionId },
    select: paymentSelect,
  });

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
  }

  if (
    payment.status === PaymentStatus.SUCCESS &&
    payload.status === PaymentStatus.SUCCESS
  ) {
    return payment;
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: payload.status,
      paymentUrl: payload.paymentUrl ?? payment.paymentUrl,
    },
    select: paymentSelect,
  });

  if (updatedPayment.status === PaymentStatus.SUCCESS) {
    await SubscriptionRenewalService.applySuccessfulRenewal(updatedPayment.id);
  }

  return updatedPayment;
};

export const PaymentServices = {
  checkout,
  getPayments,
  getPayment,
  createSubscriptionRenewalPayment,
  processWebhook,
};
