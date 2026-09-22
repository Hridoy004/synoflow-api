import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
  OrganizationRole,
  OrganizationStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  ICreateOrganizationPayload,
  IOrganizationQuery,
  IUpdateOrganizationPayload,
} from "./organization.interface";

const organizationSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

const getMembership = async (organizationId: string, userId: string) => {
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

const getActiveOrganization = async (organizationId: string) => {
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      status: OrganizationStatus.ACTIVE,
      deletedAt: null,
    },
    select: organizationSelect,
  });

  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, "Organization not found.");
  }

  return organization;
};

const createOrganization = async (
  userId: string,
  payload: ICreateOrganizationPayload,
) => {
  try {
    return await prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.create({
        data: {
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
          createdById: userId,
        },
        select: organizationSelect,
      });

      await transaction.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId,
          role: OrganizationRole.OWNER,
        },
      });

      return { ...organization, role: OrganizationRole.OWNER };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Organization slug already exists.",
      );
    }
    throw error;
  }
};

const getMyOrganizations = async (
  userId: string,
  query: IOrganizationQuery,
) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";

  const where = {
    userId,
    organization: {
      status: OrganizationStatus.ACTIVE,
      deletedAt: null,
    },
  };

  const memberships = await prisma.organizationMember.findMany({
    where,
    skip,
    take: limit,
    select: {
      role: true,
      organization: { select: organizationSelect },
    },
    orderBy: { organization: { [sortBy]: sortOrder } },
  });

  const total = await prisma.organizationMember.count({ where });

  return {
    data: memberships.map(({ organization, role }) => ({
      ...organization,
      role,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getOrganization = async (organizationId: string, userId: string) => {
  const organization = await getActiveOrganization(organizationId);
  const membership = await getMembership(organizationId, userId);

  return { ...organization, role: membership.role };
};

const updateOrganization = async (
  organizationId: string,
  userId: string,
  payload: IUpdateOrganizationPayload,
) => {
  await getActiveOrganization(organizationId);
  const membership = await getMembership(organizationId, userId);

  if (membership.role !== OrganizationRole.OWNER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the organization owner can update this organization.",
    );
  }

  try {
    return await prisma.organization.update({
      where: { id: organizationId },
      data: payload,
      select: organizationSelect,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Organization slug already exists.",
      );
    }
    throw error;
  }
};

const deleteOrganization = async (organizationId: string, userId: string) => {
  await getActiveOrganization(organizationId);
  const membership = await getMembership(organizationId, userId);

  if (membership.role !== OrganizationRole.OWNER) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the organization owner can delete this organization.",
    );
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { deletedAt: new Date() },
  });
};

export const OrganizationServices = {
  createOrganization,
  getMyOrganizations,
  getOrganization,
  updateOrganization,
  deleteOrganization,
};
