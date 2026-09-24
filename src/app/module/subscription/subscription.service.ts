import httpStatus from "http-status";
import {
  ActivityAction,
  ActivityEntity,
  OrganizationRole,
  OrganizationStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { createActivity } from "../activity/activity.service";
import { PlanLimitService } from "./plan-limit.service";
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
): T & { limits: ReturnType<typeof PlanLimitService.getPlanLimits> } => ({
  ...subscription,
  limits: PlanLimitService.getPlanLimits(subscription.plan),
});

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

  const existingSubscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { id: true, status: true },
  });

  if (existingSubscription) {
    throw new AppError(
      httpStatus.CONFLICT,
      "An active subscription already exists for this organization.",
    );
  }

  const plan = payload.plan ?? SubscriptionPlan.FREE;
  const currentPeriodStart = new Date();
  const currentPeriodEnd =
    plan === SubscriptionPlan.FREE
      ? null
      : new Date(currentPeriodStart.getTime());

  if (currentPeriodEnd) {
    currentPeriodEnd.setUTCMonth(currentPeriodEnd.getUTCMonth() + 1);
  }

  const subscription = await prisma.subscription.create({
    data: {
      organizationId,
      plan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
    select: subscriptionSelect,
  });

  await createActivity({
    organizationId,
    userId,
    entityType: ActivityEntity.SUBSCRIPTION,
    entityId: subscription.id,
    action: ActivityAction.CREATE,
    metadata: {
      plan: subscription.plan,
      status: subscription.status,
    },
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

  const updatedSubscription = await prisma.subscription.update({
    where: { organizationId },
    data: {
      ...(payload.plan ? { plan: payload.plan } : {}),
      ...(payload.cancelAtPeriodEnd !== undefined
        ? { cancelAtPeriodEnd: payload.cancelAtPeriodEnd }
        : {}),
    },
    select: subscriptionSelect,
  });

  await createActivity({
    organizationId,
    userId,
    entityType: ActivityEntity.SUBSCRIPTION,
    entityId: updatedSubscription.id,
    action: ActivityAction.UPDATE,
    metadata: {
      previousPlan: currentSubscription.plan,
      nextPlan: updatedSubscription.plan,
      cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
    },
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

  const updatedSubscription = await prisma.subscription.update({
    where: { organizationId },
    data: {
      cancelAtPeriodEnd: true,
    },
    select: subscriptionSelect,
  });

  await createActivity({
    organizationId,
    userId,
    entityType: ActivityEntity.SUBSCRIPTION,
    entityId: updatedSubscription.id,
    action: ActivityAction.UPDATE,
    metadata: {
      cancelAtPeriodEnd: true,
      status: updatedSubscription.status,
    },
  });

  return serializeSubscription(updatedSubscription);
};

export const SubscriptionServices = {
  getSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
};
