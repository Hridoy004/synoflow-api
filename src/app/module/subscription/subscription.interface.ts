import type {
  SubscriptionPlan,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";

export interface ICreateSubscriptionPayload {
  plan?: SubscriptionPlan;
}

export interface IPlanLimitSummary {
  members: number;
  teams: number;
  projects: number;
  tasksPerProject: number;
  storageBytes: number;
  maxFileSizeBytes: number;
}

export interface IUpdateSubscriptionPayload {
  plan?: SubscriptionPlan;
  cancelAtPeriodEnd?: boolean;
}

export interface ISubscriptionSummary {
  id: string;
  organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
  limits?: IPlanLimitSummary;
}
