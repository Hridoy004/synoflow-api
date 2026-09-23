import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
  OrganizationStatus,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
  ICreateTaskPayload,
  IMoveTaskPayload,
  ISubtaskPayload,
  ITaskAssigneePayload,
  ITaskPriorityPayload,
  ITaskQuery,
  ITaskStatusPayload,
  IUpdateTaskPayload,
} from "./task.interface";

const parsePositiveInt = (
  value: number | string | undefined,
  fallback: number,
) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const taskListSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  assigneeId: true,
  sprintId: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  assignee: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  },
  sprint: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

const taskDetailSelect = {
  ...taskListSelect,
  projectId: true,
  creatorId: true,
  parentTaskId: true,
  position: true,
  creator: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      key: true,
      organizationId: true,
    },
  },
  parentTask: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
} as const;

const allowedSortFields = [
  "createdAt",
  "updatedAt",
  "title",
  "priority",
  "status",
  "dueDate",
] as const;

const sortOrderValues = ["asc", "desc"] as const;

const formatTaskSummary = (task: {
  assignee?: { id: string; name: string; imageUrl: string | null } | null;
  sprint?: { id: string; name: string } | null;
}) => ({
  ...task,
  assignee: task.assignee
    ? {
        id: task.assignee.id,
        name: task.assignee.name,
        avatar: task.assignee.imageUrl || null,
      }
    : null,
  sprint: task.sprint
    ? {
        id: task.sprint.id,
        name: task.sprint.name,
      }
    : null,
});

const formatTaskDetails = (task: {
  assignee?: { id: string; name: string; imageUrl: string | null } | null;
  creator?: { id: string; name: string; imageUrl: string | null } | null;
  project?: {
    id: string;
    name: string;
    key: string;
    organizationId: string;
  } | null;
  sprint?: { id: string; name: string } | null;
  parentTask?: { id: string; title: string; status: TaskStatus } | null;
  subtasksCount?: number;
}) => ({
  ...task,
  assignee: task.assignee
    ? {
        id: task.assignee.id,
        name: task.assignee.name,
        avatar: task.assignee.imageUrl || null,
      }
    : null,
  creator: task.creator
    ? {
        id: task.creator.id,
        name: task.creator.name,
        avatar: task.creator.imageUrl || null,
      }
    : null,
  project: task.project
    ? {
        id: task.project.id,
        name: task.project.name,
        key: task.project.key,
        organizationId: task.project.organizationId,
      }
    : null,
  sprint: task.sprint
    ? {
        id: task.sprint.id,
        name: task.sprint.name,
      }
    : null,
  parentTask: task.parentTask
    ? {
        id: task.parentTask.id,
        title: task.parentTask.title,
        status: task.parentTask.status,
      }
    : null,
  subtasksCount: task.subtasksCount ?? 0,
});

const buildTaskListWhere = (
  projectId: string,
  query: ITaskQuery,
  search?: string,
): Prisma.TaskWhereInput => ({
  projectId,
  deletedAt: null,
  ...(query.status ? { status: query.status } : {}),
  ...(query.priority ? { priority: query.priority } : {}),
  ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
  ...(query.sprintId ? { sprintId: query.sprintId } : {}),
  ...(search
    ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }
    : {}),
});

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

const getProjectRecord = async (projectId: string) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      key: true,
    },
  });
  if (!project) throw new AppError(httpStatus.NOT_FOUND, "Project not found.");
  return project;
};

const assertProjectAccess = async (projectId: string, userId: string) => {
  const project = await getProjectRecord(projectId);
  const organizationMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: project.organizationId,
      userId,
      organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
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
  if (!organizationMembership && !projectMembership)
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have access to this project.",
    );
  return project;
};

const getTaskRecord = async (taskId: string) => {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      ...taskDetailSelect,
      project: {
        select: {
          id: true,
          name: true,
          key: true,
          organizationId: true,
        },
      },
    },
  });
  if (!task) throw new AppError(httpStatus.NOT_FOUND, "Task not found.");
  return task;
};

const assertValidAssigneeForProject = async (
  projectId: string,
  assigneeId: string | null,
) => {
  if (!assigneeId) return;
  const project = await getProjectRecord(projectId);
  const assignee = await prisma.user.findFirst({
    where: {
      id: assigneeId,
      isDeleted: false,
      status: UserStatus.ACTIVE,
    },
    select: { id: true },
  });
  if (!assignee) throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  const organizationMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: project.organizationId,
      userId: assigneeId,
      organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
    },
    select: { id: true },
  });
  const projectMembership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId: assigneeId },
    },
    select: { id: true },
  });
  if (!organizationMembership && !projectMembership)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Assignee must belong to the same organization or project.",
    );
};

const assertValidSprintForProject = async (
  projectId: string,
  sprintId: string | null,
) => {
  if (!sprintId) return;
  const sprint = await prisma.sprint.findFirst({
    where: {
      id: sprintId,
      projectId,
      deletedAt: null,
      project: {
        deletedAt: null,
        organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
      },
    },
    select: { id: true },
  });
  if (!sprint)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Sprint does not belong to this project.",
    );
};

const validateStatusTransition = (
  currentStatus: TaskStatus,
  nextStatus: TaskStatus,
) => {
  if (currentStatus === nextStatus) return;
  const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
    [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
    [TaskStatus.IN_PROGRESS]: [
      TaskStatus.IN_REVIEW,
      TaskStatus.DONE,
      TaskStatus.CANCELLED,
    ],
    [TaskStatus.IN_REVIEW]: [
      TaskStatus.DONE,
      TaskStatus.IN_PROGRESS,
      TaskStatus.CANCELLED,
    ],
    [TaskStatus.DONE]: [TaskStatus.CANCELLED],
    [TaskStatus.CANCELLED]: [],
  };
  if (!allowedTransitions[currentStatus]?.includes(nextStatus))
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid status transition from ${currentStatus} to ${nextStatus}.`,
    );
};

const createTask = async (
  projectId: string,
  userId: string,
  payload: ICreateTaskPayload,
) => {
  await assertProjectAccess(projectId, userId);
  await assertValidAssigneeForProject(projectId, payload.assigneeId ?? null);
  await assertValidSprintForProject(projectId, payload.sprintId ?? null);
  const task = await prisma.task.create({
    data: {
      projectId,
      title: payload.title,
      description: payload.description ?? null,
      status: payload.status ?? TaskStatus.TODO,
      priority: payload.priority ?? TaskPriority.MEDIUM,
      assigneeId: payload.assigneeId ?? null,
      sprintId: payload.sprintId ?? null,
      creatorId: userId,
      dueDate: payload.dueDate ?? null,
      position: payload.position ?? null,
    },
    select: taskDetailSelect,
  });
  return task;
};

const getProjectTasks = async (
  projectId: string,
  userId: string,
  query: ITaskQuery,
) => {
  await assertProjectAccess(projectId, userId);
  if (query.assigneeId)
    await assertValidAssigneeForProject(projectId, query.assigneeId);
  if (query.sprintId)
    await assertValidSprintForProject(projectId, query.sprintId);

  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  const search = query.search?.trim();
  const sortBy = (query.sortBy ?? "createdAt") as
    | (typeof allowedSortFields)[number]
    | string;
  const sortOrder = query.sortOrder ?? "desc";

  if (
    !allowedSortFields.includes(sortBy as (typeof allowedSortFields)[number])
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid sort field. Allowed fields: createdAt, updatedAt, title, priority, status, dueDate.",
    );
  }

  if (
    !sortOrderValues.includes(sortOrder as (typeof sortOrderValues)[number])
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid sort order. Use asc or desc.",
    );
  }

  const where = buildTaskListWhere(projectId, query, search);
  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder } as Prisma.TaskOrderByWithRelationInput,
      select: taskListSelect,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    data: data.map((task) => formatTaskSummary(task)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getTask = async (taskId: string, userId: string) => {
  const task = await getTaskRecord(taskId);
  await assertProjectAccess(task.projectId, userId);
  const subtasksCount = await prisma.task.count({
    where: { parentTaskId: task.id, deletedAt: null },
  });
  return {
    ...formatTaskDetails({
      ...task,
      subtasksCount,
    }),
  };
};

const updateTask = async (
  taskId: string,
  userId: string,
  payload: IUpdateTaskPayload,
) => {
  const task = await getTaskRecord(taskId);
  await assertProjectAccess(task.projectId, userId);
  if (payload.assigneeId !== undefined)
    await assertValidAssigneeForProject(task.projectId, payload.assigneeId);
  if (payload.sprintId !== undefined)
    await assertValidSprintForProject(task.projectId, payload.sprintId);

  if (payload.title !== undefined && !payload.title.trim())
    throw new AppError(httpStatus.BAD_REQUEST, "Task title is required.");

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.assigneeId !== undefined
        ? { assigneeId: payload.assigneeId }
        : {}),
      ...(payload.sprintId !== undefined ? { sprintId: payload.sprintId } : {}),
      ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
      ...(payload.position !== undefined ? { position: payload.position } : {}),
    },
    select: taskDetailSelect,
  });
  return updatedTask;
};

const deleteTask = async (taskId: string, userId: string) => {
  const task = await getTaskRecord(taskId);
  await assertProjectAccess(task.projectId, userId);
  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });
};

const updateTaskStatus = async (
  taskId: string,
  userId: string,
  payload: ITaskStatusPayload,
) => {
  const task = await getTaskRecord(taskId);
  await assertProjectAccess(task.projectId, userId);
  validateStatusTransition(task.status, payload.status);
  return prisma.task.update({
    where: { id: taskId },
    data: { status: payload.status },
    select: taskDetailSelect,
  });
};

const updateTaskPriority = async (
  taskId: string,
  userId: string,
  payload: ITaskPriorityPayload,
) => {
  const task = await getTaskRecord(taskId);
  await assertProjectAccess(task.projectId, userId);
  return prisma.task.update({
    where: { id: taskId },
    data: { priority: payload.priority },
    select: taskDetailSelect,
  });
};

const updateTaskAssignee = async (
  taskId: string,
  userId: string,
  payload: ITaskAssigneePayload,
) => {
  const task = await getTaskRecord(taskId);
  await assertProjectAccess(task.projectId, userId);
  if (payload.assigneeId !== null)
    await assertValidAssigneeForProject(task.projectId, payload.assigneeId);
  return prisma.task.update({
    where: { id: taskId },
    data: { assigneeId: payload.assigneeId },
    select: taskDetailSelect,
  });
};

const createSubtask = async (
  parentTaskId: string,
  userId: string,
  payload: ISubtaskPayload,
) => {
  const parentTask = await getTaskRecord(parentTaskId);
  await assertProjectAccess(parentTask.projectId, userId);
  await assertValidAssigneeForProject(
    parentTask.projectId,
    payload.assigneeId ?? null,
  );
  const subtask = await prisma.task.create({
    data: {
      projectId: parentTask.projectId,
      parentTaskId,
      title: payload.title,
      description: payload.description ?? null,
      status: payload.status ?? TaskStatus.TODO,
      priority: payload.priority ?? TaskPriority.MEDIUM,
      assigneeId: payload.assigneeId ?? null,
      creatorId: userId,
      dueDate: payload.dueDate ?? null,
      position: payload.position ?? null,
    },
    select: taskDetailSelect,
  });
  return subtask;
};

const getSubtasks = async (
  taskId: string,
  userId: string,
  query: ITaskQuery,
) => {
  const parentTask = await getTaskRecord(taskId);
  await assertProjectAccess(parentTask.projectId, userId);
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where: {
        parentTaskId: taskId,
        deletedAt: null,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: taskListSelect,
    }),
    prisma.task.count({
      where: {
        parentTaskId: taskId,
        deletedAt: null,
      },
    }),
  ]);
  return {
    data: data.map((task) => formatTaskSummary(task)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const moveTask = async (
  taskId: string,
  userId: string,
  payload: IMoveTaskPayload,
) => {
  const task = await getTaskRecord(taskId);
  await assertProjectAccess(task.projectId, userId);
  if (payload.sprintId !== undefined)
    await assertValidSprintForProject(task.projectId, payload.sprintId);
  if (payload.status !== undefined)
    validateStatusTransition(task.status, payload.status);

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.sprintId !== undefined ? { sprintId: payload.sprintId } : {}),
      ...(payload.position !== undefined ? { position: payload.position } : {}),
    },
    select: taskDetailSelect,
  });
  return updatedTask;
};

export const TaskServices = {
  createTask,
  getProjectTasks,
  getTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskPriority,
  updateTaskAssignee,
  createSubtask,
  getSubtasks,
  moveTask,
};
