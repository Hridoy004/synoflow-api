import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
  OrganizationRole,
  OrganizationStatus,
  UserStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { PlanLimitService } from "../subscription/plan-limit.service";
import type {
  ICreateProjectPayload,
  IProjectMemberPayload,
  IProjectQuery,
  IUpdateProjectPayload,
} from "./project.interface";

const projectSelect = {
  id: true,
  organizationId: true,
  teamId: true,
  createdById: true,
  name: true,
  key: true,
  description: true,
  status: true,
  startDate: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  imageUrl: true,
} as const;
const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getOrganizationMembership = async (
  organizationId: string,
  userId: string,
) => {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
    },
    select: { role: true },
  });
  if (!membership)
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not a member of this organization.",
    );
  return membership;
};

const assertOwner = async (organizationId: string, userId: string) => {
  const membership = await getOrganizationMembership(organizationId, userId);
  if (membership.role !== OrganizationRole.OWNER)
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the organization owner can perform this action.",
    );
};

const getActiveOrganization = async (organizationId: string) => {
  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      status: OrganizationStatus.ACTIVE,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!organization)
    throw new AppError(httpStatus.NOT_FOUND, "Organization not found.");
  return organization;
};

const getProjectRecord = async (projectId: string) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
    },
    select: {
      ...projectSelect,
      organization: { select: { id: true, name: true, slug: true } },
      team: { select: { id: true, name: true } },
    },
  });
  if (!project) throw new AppError(httpStatus.NOT_FOUND, "Project not found.");
  return project;
};

const assertDates = (startDate?: Date | null, dueDate?: Date | null) => {
  if (startDate && dueDate && startDate > dueDate)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Project due date must be on or after its start date.",
    );
};

const assertTeam = async (organizationId: string, teamId?: string | null) => {
  if (!teamId) return;
  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!team)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Team does not belong to this organization.",
    );
};

const createProject = async (
  organizationId: string,
  userId: string,
  payload: ICreateProjectPayload,
) => {
  await getActiveOrganization(organizationId);
  await assertOwner(organizationId, userId);
  assertDates(payload.startDate, payload.dueDate);
  await assertTeam(organizationId, payload.teamId);
  await PlanLimitService.checkProjectLimit(organizationId);
  try {
    return await prisma.$transaction(async (transaction) => {
      const project = await transaction.project.create({
        data: { ...payload, organizationId, createdById: userId },
        select: projectSelect,
      });
      await transaction.projectMember.create({
        data: { projectId: project.id, userId },
      });
      return project;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AppError(
        httpStatus.CONFLICT,
        "A project with this key already exists in the organization.",
      );
    throw error;
  }
};

const getOrganizationProjects = async (
  organizationId: string,
  userId: string,
  query: IProjectQuery,
) => {
  await getActiveOrganization(organizationId);
  await getOrganizationMembership(organizationId, userId);
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 10), 100);
  const search = query.search?.trim();
  const where: Prisma.ProjectWhereInput = {
    organizationId,
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { key: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: projectSelect,
    }),
    prisma.project.count({ where }),
  ]);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getProject = async (projectId: string, userId: string) => {
  const project = await getProjectRecord(projectId);
  await getOrganizationMembership(project.organizationId, userId);
  return project;
};

const updateProject = async (
  projectId: string,
  userId: string,
  payload: IUpdateProjectPayload,
) => {
  const project = await getProjectRecord(projectId);
  await assertOwner(project.organizationId, userId);
  assertDates(
    payload.startDate ?? project.startDate,
    payload.dueDate ?? project.dueDate,
  );
  await assertTeam(project.organizationId, payload.teamId);
  try {
    return await prisma.project.update({
      where: { id: projectId },
      data: payload,
      select: projectSelect,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AppError(
        httpStatus.CONFLICT,
        "A project with this key already exists in the organization.",
      );
    throw error;
  }
};

const deleteProject = async (projectId: string, userId: string) => {
  const project = await getProjectRecord(projectId);
  await assertOwner(project.organizationId, userId);
  await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });
};

const addProjectMember = async (
  projectId: string,
  userId: string,
  payload: IProjectMemberPayload,
) => {
  const project = await getProjectRecord(projectId);
  await assertOwner(project.organizationId, userId);
  const targetMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: project.organizationId,
        userId: payload.userId,
      },
    },
    select: { user: { select: safeUserSelect } },
  });
  if (!targetMembership)
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User is not a member of this organization.",
    );
  const targetUser = await prisma.user.findFirst({
    where: { id: payload.userId, isDeleted: false, status: UserStatus.ACTIVE },
    select: safeUserSelect,
  });
  if (!targetUser) throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  try {
    return await prisma.projectMember.create({
      data: { projectId, userId: payload.userId },
      select: {
        id: true,
        projectId: true,
        createdAt: true,
        user: { select: safeUserSelect },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AppError(
        httpStatus.CONFLICT,
        "User is already a project member.",
      );
    throw error;
  }
};

const getProjectMembers = async (
  projectId: string,
  userId: string,
  query: IProjectQuery,
) => {
  const project = await getProjectRecord(projectId);
  await getOrganizationMembership(project.organizationId, userId);
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 10), 100);
  const where = { projectId };
  const [members, total] = await Promise.all([
    prisma.projectMember.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "asc" },
      select: {
        userId: true,
        createdAt: true,
        user: { select: safeUserSelect },
      },
    }),
    prisma.projectMember.count({ where }),
  ]);
  return {
    data: members.map(({ userId: memberUserId, createdAt, user }) => ({
      userId: memberUserId,
      name: user.name,
      email: user.email,
      avatar: user.imageUrl || null,
      createdAt,
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const removeProjectMember = async (
  projectId: string,
  userId: string,
  targetUserId: string,
) => {
  const project = await getProjectRecord(projectId);
  await assertOwner(project.organizationId, userId);
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    select: { id: true },
  });
  if (!membership)
    throw new AppError(httpStatus.NOT_FOUND, "Project member not found.");
  await prisma.projectMember.delete({ where: { id: membership.id } });
};

export const ProjectServices = {
  createProject,
  getOrganizationProjects,
  getProject,
  updateProject,
  deleteProject,
  addProjectMember,
  getProjectMembers,
  removeProjectMember,
};
