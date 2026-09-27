import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
  PaymentStatus,
  SubscriptionStatus,
  SystemRole,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  IAdminAuditLogQuery,
  IAdminUserQuery,
  IUpdateUserRolePayload,
} from "./admin.interface";

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  imageUrl: true,
  systemRole: true,
  status: true,
  authProvider: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getUsers = async (query: IAdminUserQuery) => {
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  const search = query.search?.trim();

  const where: Prisma.UserWhereInput = {
    isDeleted: false,
    ...(query.status ? { status: query.status } : {}),
    ...(query.systemRole ? { systemRole: query.systemRole } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: safeUserSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const updateUserRole = async (
  actorUserId: string,
  targetUserId: string,
  payload: IUpdateUserRolePayload,
) => {
  if (actorUserId === targetUserId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You cannot change your own role.",
    );
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: targetUserId, isDeleted: false },
    select: { id: true, systemRole: true },
  });

  if (!targetUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }

  if (
    targetUser.systemRole === SystemRole.SUPER_ADMIN &&
    payload.systemRole !== SystemRole.SUPER_ADMIN
  ) {
    const superAdminCount = await prisma.user.count({
      where: { systemRole: SystemRole.SUPER_ADMIN, isDeleted: false },
    });

    if (superAdminCount <= 1) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Cannot remove the last remaining SUPER_ADMIN.",
      );
    }
  }

  return prisma.user.update({
    where: { id: targetUserId },
    data: { systemRole: payload.systemRole },
    select: safeUserSelect,
  });
};

const getDashboardStats = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalOrganizations,
    subscriptionsByPlan,
    activeSubscriptionCount,
    monthlyRevenue,
    newSignups7d,
    newSignups30d,
    newOrganizations30d,
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.subscription.groupBy({
      by: ["plan"],
      where: { status: SubscriptionStatus.ACTIVE },
      _count: { _all: true },
    }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.SUCCESS, paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.user.count({
      where: { isDeleted: false, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.user.count({
      where: { isDeleted: false, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.organization.count({
      where: { deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  return {
    users: {
      total: totalUsers,
      newLast7Days: newSignups7d,
      newLast30Days: newSignups30d,
    },
    organizations: {
      total: totalOrganizations,
      newLast30Days: newOrganizations30d,
    },
    subscriptions: {
      activeTotal: activeSubscriptionCount,
      byPlan: subscriptionsByPlan.map((row) => ({
        plan: row.plan,
        count: row._count._all,
      })),
    },
    revenue: {
      currentMonth: monthlyRevenue._sum.amount ?? 0,
      currency: "BDT",
    },
  };
};

const getAuditLogs = async (query: IAdminAuditLogQuery) => {
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 20), 100);

  const where: Prisma.ActivityWhereInput = {
    ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.activity.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const AdminServices = {
  getUsers,
  updateUserRole,
  getDashboardStats,
  getAuditLogs,
};
