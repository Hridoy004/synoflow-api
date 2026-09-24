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

const PLAN_PRICE_BY_PLAN: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.PRO]: 49,
  [SubscriptionPlan.BUSINESS]: 99,
};

export type RenewalCandidate = {
  id: string;
  organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  organization: {
    id: string;
    createdById: string;
  };
};

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
    if (!subscription || !subscription.currentPeriodEnd) {
      return false;
    }

    if (subscription.plan === SubscriptionPlan.FREE) {
      return false;
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }

    if (subscription.cancelAtPeriodEnd) {
      return false;
    }

    return new Date(subscription.currentPeriodEnd) <= now;
  },

  calculateNextPeriod(previousPeriodEnd: Date) {
    const start = new Date(previousPeriodEnd);
    const end = new Date(previousPeriodEnd);
    end.setUTCMonth(end.getUTCMonth() + 1);

    return {
      start,
      end,
    };
  },

  async findRenewalCandidates(now: Date = new Date()) {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        plan: {
          in: [SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS],
        },
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: {
          lte: now,
        },
      },
      select: {
        id: true,
        organizationId: true,
        plan: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        organization: {
          select: {
            id: true,
            createdById: true,
          },
        },
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
        organization: {
          select: {
            id: true,
            createdById: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new AppError(httpStatus.NOT_FOUND, "Subscription not found.");
    }

    if (!SubscriptionRenewalService.isRenewalEligible(subscription)) {
      return {
        executed: false,
        reason: "not_due",
      };
    }

    const existingPayments = await prisma.payment.findMany({
      where: {
        organizationId: subscription.organizationId,
        userId: subscription.organization.createdById,
        status: {
          in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS],
        },
      },
      select: {
        id: true,
        metadata: true,
        status: true,
      },
    });

    const periodKey = subscription.currentPeriodEnd?.toISOString();
    const existingRenewal = existingPayments.find((payment) => {
      const metadata = payment.metadata as Record<string, unknown> | null;
      const isRenewal = metadata?.type === "subscription_renewal";
      const matchesSubscription = metadata?.subscriptionId === subscription.id;
      const matchesPeriod = metadata?.billingPeriodEnd === periodKey;
      return isRenewal && matchesSubscription && matchesPeriod;
    });

    if (existingRenewal) {
      return {
        executed: false,
        reason: "already_in_progress",
        paymentId: existingRenewal.id,
      };
    }

    const payment = await PaymentServices.createSubscriptionRenewalPayment({
      organizationId: subscription.organizationId,
      userId: subscription.organization.createdById,
      plan: subscription.plan,
      subscriptionId: subscription.id,
      amount: PLAN_PRICE_BY_PLAN[subscription.plan] ?? 0,
      billingPeriodEnd: periodKey ?? new Date().toISOString(),
    });

    if (!payment) {
      return {
        executed: false,
        reason: "payment_not_created",
      };
    }

    return {
      executed: true,
      paymentId: payment.id,
      status: payment.status,
    };
  },

  async processRenewalBatch(now: Date = new Date()) {
    const candidates =
      await SubscriptionRenewalService.findRenewalCandidates(now);

    const results: Array<{
      subscriptionId: string;
      executed: boolean;
      paymentId?: string;
      reason?: string;
    }> = [];

    for (const candidate of candidates) {
      const result =
        await SubscriptionRenewalService.processRenewalForSubscription(
          candidate.id,
        );
      results.push({
        subscriptionId: candidate.id,
        ...result,
      });
    }

    return results;
  },

  async applySuccessfulRenewal(paymentId: string) {
    const payment = await prisma.payment.findUnique({
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
      return {
        result: "not_processed",
      };
    }

    const metadata = payment.metadata as Record<string, unknown> | null;
    const subscriptionId = metadata?.subscriptionId as string | undefined;
    const billingPeriodEnd = metadata?.billingPeriodEnd as string | undefined;

    if (!subscriptionId) {
      return {
        result: "not_subscription_payment",
      };
    }

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

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return {
        result: "subscription_not_active",
      };
    }

    const previousPeriodEnd = subscription.currentPeriodEnd ?? new Date();
    const { start, end } =
      SubscriptionRenewalService.calculateNextPeriod(previousPeriodEnd);

    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: false,
      },
    });

    await createActivity({
      organizationId: subscription.organizationId,
      userId: payment.userId,
      entityType: ActivityEntity.SUBSCRIPTION,
      entityId: updatedSubscription.id,
      action: ActivityAction.UPDATE,
      metadata: {
        renewal: true,
        previousPeriodEnd: billingPeriodEnd ?? previousPeriodEnd.toISOString(),
        nextPeriodStart: start.toISOString(),
        nextPeriodEnd: end.toISOString(),
        plan: updatedSubscription.plan,
      },
    });

    return {
      result: "processed",
      subscriptionId: updatedSubscription.id,
      currentPeriodStart: updatedSubscription.currentPeriodStart,
      currentPeriodEnd: updatedSubscription.currentPeriodEnd,
    };
  },
};
