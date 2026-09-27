import httpStatus from "http-status";
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { getPlanLimits, PLAN_LIMITS } from "./config/plan.config";

export { PLAN_LIMITS };

const getSubscriptionPlanForOrganization = async (
  organizationId: string,
): Promise<SubscriptionPlan> => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: true, status: true },
  });

  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return SubscriptionPlan.FREE;
  }

  return subscription.plan;
};

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

  getSubscriptionPlanForOrganization,

  async checkMemberLimit(organizationId: string) {
    const plan = await getSubscriptionPlanForOrganization(organizationId);
    const limit = getPlanLimits(plan).members;

    const currentCount = await prisma.organizationMember.count({
      where: { organizationId },
    });

    if (currentCount >= limit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Member limit reached for the ${plan} plan (${limit} members). Upgrade your plan to add more members.`,
      );
    }
  },

  async checkTeamLimit(organizationId: string) {
    const plan = await getSubscriptionPlanForOrganization(organizationId);
    const limit = getPlanLimits(plan).teams;

    const currentCount = await prisma.team.count({
      where: { organizationId, deletedAt: null },
    });

    if (currentCount >= limit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Team limit reached for the ${plan} plan (${limit} teams). Upgrade your plan to add more teams.`,
      );
    }
  },

  async checkProjectLimit(organizationId: string) {
    const plan = await getSubscriptionPlanForOrganization(organizationId);
    const limit = getPlanLimits(plan).projects;

    const currentCount = await prisma.project.count({
      where: { organizationId, deletedAt: null },
    });

    if (currentCount >= limit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Project limit reached for the ${plan} plan (${limit} projects). Upgrade your plan to add more projects.`,
      );
    }
  },

  async checkTaskLimit(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) {
      throw new AppError(httpStatus.NOT_FOUND, "Project not found.");
    }

    const plan = await getSubscriptionPlanForOrganization(
      project.organizationId,
    );
    const limit = getPlanLimits(plan).tasksPerProject;

    const currentCount = await prisma.task.count({
      where: { projectId, deletedAt: null },
    });

    if (currentCount >= limit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Task limit reached for the ${plan} plan (${limit} tasks per project). Upgrade your plan to add more tasks.`,
      );
    }
  },

  async checkStorageLimit(organizationId: string, additionalBytes: number) {
    const plan = await getSubscriptionPlanForOrganization(organizationId);
    const { storageBytes, maxFileSizeBytes } = getPlanLimits(plan);

    if (additionalBytes > maxFileSizeBytes) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `File exceeds the maximum file size for the ${plan} plan (${Math.floor(
          maxFileSizeBytes / (1024 * 1024),
        )} MB).`,
      );
    }

    const usage = await prisma.attachment.aggregate({
      where: {
        deletedAt: null,
        task: { project: { organizationId, deletedAt: null } },
      },
      _sum: { size: true },
    });

    const currentUsage = usage._sum.size ?? 0;

    if (currentUsage + additionalBytes > storageBytes) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Storage limit reached for the ${plan} plan (${Math.floor(
          storageBytes / (1024 * 1024),
        )} MB). Upgrade your plan or remove old attachments.`,
      );
    }
  },
};
