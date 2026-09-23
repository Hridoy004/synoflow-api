import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
  ActivityAction,
  ActivityEntity,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

export type CreateActivityInput = {
  organizationId: string;
  userId: string;
  entityType: ActivityEntity;
  entityId: string;
  action: ActivityAction;
  metadata?: Record<string, unknown> | null;
};

export const createActivity = async ({
  organizationId,
  userId,
  entityType,
  entityId,
  action,
  metadata,
}: CreateActivityInput) => {
  if (!organizationId || !userId || !entityId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Activity payload is incomplete.",
    );
  }

  return prisma.activity.create({
    data: {
      organizationId,
      userId,
      entityType,
      entityId,
      action,
      metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
    },
  });
};
