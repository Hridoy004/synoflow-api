import { SubscriptionPlan } from "../../../generated/prisma/enums";

export const PLAN_LIMITS = {
  [SubscriptionPlan.FREE]: {
    price: 0,
    members: 5,
    teams: 2,
    projects: 3,
    tasksPerProject: 100,
    storageBytes: 500 * 1024 * 1024,
    maxFileSizeBytes: 5 * 1024 * 1024,
  },
  [SubscriptionPlan.PRO]: {
    price: 49,
    members: 25,
    teams: 10,
    projects: 15,
    tasksPerProject: 1000,
    storageBytes: 10 * 1024 * 1024 * 1024,
    maxFileSizeBytes: 25 * 1024 * 1024,
  },
  [SubscriptionPlan.BUSINESS]: {
    price: 99,
    members: 100,
    teams: 30,
    projects: 50,
    tasksPerProject: 5000,
    storageBytes: 50 * 1024 * 1024 * 1024,
    maxFileSizeBytes: 100 * 1024 * 1024,
  },
} as const;

export const getPlanLimits = (plan: SubscriptionPlan) => PLAN_LIMITS[plan];
export const getPlanPrice = (plan: SubscriptionPlan) => PLAN_LIMITS[plan].price;
