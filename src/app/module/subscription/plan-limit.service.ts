import httpStatus from "http-status";
import {
  OrganizationStatus,
  SubscriptionPlan,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

export const PLAN_LIMITS = {
  FREE: {
    members: 5,
    teams: 2,
    projects: 3,
    tasksPerProject: 100,
    storageBytes: 500 * 1024 * 1024,
    maxFileSizeBytes: 5 * 1024 * 1024,
  },
  PRO: {
    members: 25,
    teams: 10,
    projects: 15,
    tasksPerProject: 1000,
    storageBytes: 10 * 1024 * 1024 * 1024,
    maxFileSizeBytes: 25 * 1024 * 1024,
  },
  BUSINESS: {
    members: 100,
    teams: 30,
    projects: 50,
    tasksPerProject: 5000,
    storageBytes: 50 * 1024 * 1024 * 1024,
    maxFileSizeBytes: 100 * 1024 * 1024,
  },
} as const;

export const PLAN_FEATURES = {
  FREE: [
    "Kanban",
    "Calendar",
    "Comments",
    "Subtasks",
    "Labels",
    "Attachments",
    "Basic task management",
    "Activity history",
  ],
  PRO: [
    "Kanban",
    "Calendar",
    "Comments",
    "Subtasks",
    "Labels",
    "Attachments",
    "Basic task management",
    "Activity history",
  ],
  BUSINESS: [
    "Kanban",
    "Calendar",
    "Comments",
    "Subtasks",
    "Labels",
    "Attachments",
    "Basic task management",
    "Activity history",
  ],
} as const;

const normalizePlan = (plan?: SubscriptionPlan | string): SubscriptionPlan => {
  if (!plan) {
    return SubscriptionPlan.FREE;
  }

  if (plan in PLAN_LIMITS) {
    return plan as SubscriptionPlan;
  }

  if (Object.values(SubscriptionPlan).includes(plan as SubscriptionPlan)) {
    return plan as SubscriptionPlan;
  }

  return SubscriptionPlan.FREE;
};

const getSubscriptionPlanForOrganization = async (organizationId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: true },
  });

  return subscription?.plan ?? SubscriptionPlan.FREE;
};

export const PlanLimitService = {
  getPlanLimits: (plan?: SubscriptionPlan | string) => {
    const normalizedPlan = normalizePlan(plan);
    return PLAN_LIMITS[normalizedPlan];
  },
  getPlanFeatures: (plan?: SubscriptionPlan | string) => {
    const normalizedPlan = normalizePlan(plan);
    return PLAN_FEATURES[normalizedPlan];
  },
  getMemberLimit: (plan?: SubscriptionPlan | string) =>
    PlanLimitService.getPlanLimits(plan).members,
  getTeamLimit: (plan?: SubscriptionPlan | string) =>
    PlanLimitService.getPlanLimits(plan).teams,
  getProjectLimit: (plan?: SubscriptionPlan | string) =>
    PlanLimitService.getPlanLimits(plan).projects,
  getTaskLimit: (plan?: SubscriptionPlan | string) =>
    PlanLimitService.getPlanLimits(plan).tasksPerProject,
  getStorageLimit: (plan?: SubscriptionPlan | string) =>
    PlanLimitService.getPlanLimits(plan).storageBytes,
  getMaxFileSize: (plan?: SubscriptionPlan | string) =>
    PlanLimitService.getPlanLimits(plan).maxFileSizeBytes,

  checkFileSizeLimit: (
    plan: SubscriptionPlan | string | undefined,
    fileSize: number,
  ) => {
    const maxSize = PlanLimitService.getMaxFileSize(plan);

    if (fileSize > maxSize) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `File exceeds the plan's max upload size of ${maxSize} bytes.`,
      );
    }

    return true;
  },

  checkMemberLimit: async (organizationId: string) => {
    const plan = await getSubscriptionPlanForOrganization(organizationId);
    const limit = PlanLimitService.getMemberLimit(plan);
    const currentMembers = await prisma.organizationMember.count({
      where: { organizationId },
    });

    if (currentMembers >= limit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Member limit reached for the ${plan} plan (${limit} members).`,
      );
    }

    return { plan, limit, currentMembers };
  },

  checkTeamLimit: async (organizationId: string) => {
    const plan = await getSubscriptionPlanForOrganization(organizationId);
    const limit = PlanLimitService.getTeamLimit(plan);
    const currentTeams = await prisma.team.count({
      where: {
        organizationId,
        deletedAt: null,
      },
    });

    if (currentTeams >= limit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Team limit reached for the ${plan} plan (${limit} teams).`,
      );
    }

    return { plan, limit, currentTeams };
  },

  checkProjectLimit: async (organizationId: string) => {
    const plan = await getSubscriptionPlanForOrganization(organizationId);
    const limit = PlanLimitService.getProjectLimit(plan);
    const currentProjects = await prisma.project.count({
      where: {
        organizationId,
        deletedAt: null,
      },
    });

    if (currentProjects >= limit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Project limit reached for the ${plan} plan (${limit} projects).`,
      );
    }

    return { plan, limit, currentProjects };
  },

  checkTaskLimit: async (projectId: string) => {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organizationId: true },
    });

    if (!project) {
      throw new AppError(httpStatus.NOT_FOUND, "Project not found.");
    }

    const plan = await getSubscriptionPlanForOrganization(
      project.organizationId,
    );
    const limit = PlanLimitService.getTaskLimit(plan);
    const currentTasks = await prisma.task.count({
      where: {
        projectId,
        deletedAt: null,
      },
    });

    if (currentTasks >= limit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Task limit reached for the ${plan} plan (${limit} tasks per project).`,
      );
    }

    return { plan, limit, currentTasks };
  },

  checkStorageLimit: async (organizationId: string, fileSize: number) => {
    const plan = await getSubscriptionPlanForOrganization(organizationId);
    const storageLimit = PlanLimitService.getStorageLimit(plan);

    PlanLimitService.checkFileSizeLimit(plan, fileSize);

    const currentStorage = await prisma.attachment.aggregate({
      _sum: { size: true },
      where: {
        deletedAt: null,
        task: {
          project: {
            organizationId,
            deletedAt: null,
            organization: {
              status: OrganizationStatus.ACTIVE,
              deletedAt: null,
            },
          },
        },
      },
    });

    const usageBytes = Number(currentStorage._sum.size ?? 0);

    if (usageBytes + fileSize > storageLimit) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Storage limit reached for the ${plan} plan (${storageLimit} bytes).`,
      );
    }

    return { plan, limit: storageLimit, currentUsage: usageBytes, fileSize };
  },
};
