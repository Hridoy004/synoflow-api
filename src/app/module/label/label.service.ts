import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { OrganizationStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  IAttachLabelPayload,
  ICreateLabelPayload,
  ILabelQuery,
  IUpdateLabelPayload,
} from "./label.interface";

const parsePositiveInt = (
  value: number | string | undefined,
  fallback: number,
) => {
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
    select: {
      id: true,
      name: true,
    },
  });

  if (!organization) {
    throw new AppError(httpStatus.NOT_FOUND, "Organization not found.");
  }

  return organization;
};

const getLabelRecord = async (labelId: string) => {
  const label = await prisma.label.findFirst({
    where: {
      id: labelId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      color: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!label) {
    throw new AppError(httpStatus.NOT_FOUND, "Label not found.");
  }

  return label;
};

const getTaskRecord = async (taskId: string) => {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
    },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          id: true,
          organizationId: true,
          deletedAt: true,
          organization: {
            select: {
              id: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found.");
  }

  if (
    task.project.deletedAt ||
    task.project.organization.deletedAt ||
    task.project.organization.status !== OrganizationStatus.ACTIVE
  ) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found.");
  }

  return task;
};

const assertProjectAccess = async (projectId: string, userId: string) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      organization: {
        status: OrganizationStatus.ACTIVE,
        deletedAt: null,
      },
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!project) {
    throw new AppError(httpStatus.NOT_FOUND, "Project not found.");
  }

  const organizationMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: project.organizationId,
      userId,
      organization: {
        status: OrganizationStatus.ACTIVE,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  const projectMembership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: { id: true },
  });

  if (!organizationMembership && !projectMembership) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have access to this project.",
    );
  }

  return project;
};

const createLabel = async (
  organizationId: string,
  userId: string,
  payload: ICreateLabelPayload,
) => {
  await getActiveOrganization(organizationId);
  await getOrganizationMembership(organizationId, userId);

  try {
    return await prisma.label.create({
      data: {
        organizationId,
        name: payload.name.trim(),
        color: payload.color ?? null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "A label with this name already exists in this organization.",
      );
    }
    throw error;
  }
};

const getOrganizationLabels = async (
  organizationId: string,
  userId: string,
  query: ILabelQuery,
) => {
  await getActiveOrganization(organizationId);
  await getOrganizationMembership(organizationId, userId);

  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  const search = query.search?.trim();
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";

  const allowedSortFields = ["name", "createdAt", "updatedAt"] as const;
  const allowedOrder = ["asc", "desc"] as const;

  if (
    !allowedSortFields.includes(sortBy as (typeof allowedSortFields)[number])
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid sort field. Allowed fields: name, createdAt, updatedAt.",
    );
  }

  if (!allowedOrder.includes(sortOrder as (typeof allowedOrder)[number])) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid sort order. Use asc or desc.",
    );
  }

  const where: Prisma.LabelWhereInput = {
    organizationId,
    deletedAt: null,
    ...(search
      ? {
          name: {
            contains: search,
            mode: "insensitive",
          },
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.label.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.label.count({ where }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateLabel = async (
  labelId: string,
  userId: string,
  payload: IUpdateLabelPayload,
) => {
  const label = await getLabelRecord(labelId);
  await getOrganizationMembership(label.organizationId, userId);

  if (payload.name !== undefined) {
    payload.name = payload.name.trim();
    if (!payload.name) {
      throw new AppError(httpStatus.BAD_REQUEST, "Label name is required.");
    }
  }

  try {
    return await prisma.label.update({
      where: { id: labelId },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.color !== undefined ? { color: payload.color } : {}),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "A label with this name already exists in this organization.",
      );
    }
    throw error;
  }
};

const deleteLabel = async (labelId: string, userId: string) => {
  const label = await getLabelRecord(labelId);
  await getOrganizationMembership(label.organizationId, userId);

  await prisma.label.update({
    where: { id: labelId },
    data: { deletedAt: new Date() },
  });
};

const attachLabelToTask = async (
  taskId: string,
  userId: string,
  payload: IAttachLabelPayload,
) => {
  const task = await getTaskRecord(taskId);
  await assertProjectAccess(task.projectId, userId);

  const label = await prisma.label.findFirst({
    where: {
      id: payload.labelId,
      organizationId: task.project.organizationId,
      deletedAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
    },
  });

  if (!label) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Label not found in this organization.",
    );
  }

  try {
    const taskLabel = await prisma.taskLabel.create({
      data: {
        taskId,
        labelId: label.id,
      },
      include: {
        label: true,
      },
    });

    return taskLabel;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "This label is already attached to the task.",
      );
    }
    throw error;
  }
};

const detachLabelFromTask = async (
  taskId: string,
  labelId: string,
  userId: string,
) => {
  const task = await getTaskRecord(taskId);
  await assertProjectAccess(task.projectId, userId);

  const label = await prisma.label.findFirst({
    where: {
      id: labelId,
      organizationId: task.project.organizationId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (!label) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Label not found in this organization.",
    );
  }

  const relation = await prisma.taskLabel.findUnique({
    where: {
      taskId_labelId: {
        taskId,
        labelId,
      },
    },
  });

  if (!relation) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "This label is not attached to the task.",
    );
  }

  await prisma.taskLabel.delete({
    where: {
      taskId_labelId: {
        taskId,
        labelId,
      },
    },
  });
};

export const LabelServices = {
  createLabel,
  getOrganizationLabels,
  updateLabel,
  deleteLabel,
  attachLabelToTask,
  detachLabelFromTask,
};
