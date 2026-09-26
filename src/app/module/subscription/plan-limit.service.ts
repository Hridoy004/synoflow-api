import {
  SubscriptionPlan,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { getPlanLimits, PLAN_LIMITS } from "./plan.config";

export { PLAN_LIMITS };

export const PlanLimitService = {
  getPlanLimits(plan: SubscriptionPlan) {
    return getPlanLimits(plan);
  },
  getMemberLimit(plan: SubscriptionPlan) {
    return getPlanLimits(plan).members;
  },
  getTeamLimit(plan: SubscriptionPlan) {
    return getPlanLimits(plan).teams;
  },
  getProjectLimit(plan: SubscriptionPlan) {
    return getPlanLimits(plan).projects;
  },
  getTaskLimit(plan: SubscriptionPlan) {
    return getPlanLimits(plan).tasksPerProject;
  },
  getStorageLimit(plan: SubscriptionPlan) {
    return getPlanLimits(plan).storageBytes;
  },
  getMaxFileSize(plan: SubscriptionPlan) {
    return getPlanLimits(plan).maxFileSizeBytes;
  },

  async getSubscriptionPlanForOrganization(
    organizationId: string,
  ): Promise<SubscriptionPlan> {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      select: { plan: true, status: true },
    });

    if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
      return SubscriptionPlan.FREE;
    }

    return subscription.plan;
  },
};
