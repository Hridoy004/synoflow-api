import httpStatus from "http-status";
import {
  ActivityAction,
  ActivityEntity,
  OrganizationStatus,
  SystemRole,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { createActivity } from "../activity/activity.service";
import type {
  ICommentQuery,
  ICreateCommentPayload,
  IUpdateCommentPayload,
} from "./comment.interface";

const parsePositiveInt = (
  value: number | string | undefined,
  fallback: number,
) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getTaskAccessContext = async (taskId: string, userId: string) => {
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

  const organizationMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: task.project.organizationId,
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
        projectId: task.projectId,
        userId,
      },
    },
    select: { id: true },
  });

  if (!organizationMembership && !projectMembership) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You do not have access to this task.",
    );
  }

  return {
    task,
    organizationId: task.project.organizationId,
  };
};

const getCommentById = async (commentId: string) => {
  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      deletedAt: null,
    },
    select: {
      id: true,
      taskId: true,
      userId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      task: {
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
      },
    },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, "Comment not found.");
  }

  if (
    comment.task.project.deletedAt ||
    comment.task.project.organization.deletedAt ||
    comment.task.project.organization.status !== OrganizationStatus.ACTIVE
  ) {
    throw new AppError(httpStatus.NOT_FOUND, "Comment not found.");
  }

  return comment;
};

const createComment = async (
  taskId: string,
  userId: string,
  payload: ICreateCommentPayload,
) => {
  const { organizationId } = await getTaskAccessContext(taskId, userId);
  const content = payload.content.trim();

  if (!content) {
    throw new AppError(httpStatus.BAD_REQUEST, "Comment content is required.");
  }

  const comment = await prisma.comment.create({
    data: {
      taskId,
      userId,
      content,
    },
    select: {
      id: true,
      taskId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
    },
  });

  await createActivity({
    organizationId,
    userId,
    entityType: ActivityEntity.COMMENT,
    entityId: comment.id,
    action: ActivityAction.CREATE,
    metadata: { taskId, content },
  });

  return {
    id: comment.id,
    taskId: comment.taskId,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: {
      id: comment.user.id,
      name: comment.user.name,
      avatar: comment.user.imageUrl || null,
    },
  };
};

const getTaskComments = async (
  taskId: string,
  userId: string,
  query: ICommentQuery,
) => {
  await getTaskAccessContext(taskId, userId);

  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 20), 100);

  const [data, total] = await Promise.all([
    prisma.comment.findMany({
      where: {
        taskId,
        deletedAt: null,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    }),
    prisma.comment.count({
      where: {
        taskId,
        deletedAt: null,
      },
    }),
  ]);

  return {
    data: data.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: {
        id: comment.user.id,
        name: comment.user.name,
        avatar: comment.user.imageUrl || null,
      },
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateComment = async (
  commentId: string,
  userId: string,
  role: SystemRole,
  payload: IUpdateCommentPayload,
) => {
  const comment = await getCommentById(commentId);
  const { organizationId } = await getTaskAccessContext(comment.taskId, userId);

  const canModify =
    comment.userId === userId ||
    role === SystemRole.ADMIN ||
    role === SystemRole.SUPER_ADMIN;

  if (!canModify) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to update this comment.",
    );
  }

  const content = payload.content?.trim();
  if (!content) {
    throw new AppError(httpStatus.BAD_REQUEST, "Comment content is required.");
  }

  const updatedComment = await prisma.comment.update({
    where: { id: commentId },
    data: { content },
    select: {
      id: true,
      taskId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
    },
  });

  await createActivity({
    organizationId,
    userId,
    entityType: ActivityEntity.COMMENT,
    entityId: updatedComment.id,
    action: ActivityAction.UPDATE,
    metadata: { taskId: updatedComment.taskId, content },
  });

  return {
    id: updatedComment.id,
    taskId: updatedComment.taskId,
    content: updatedComment.content,
    createdAt: updatedComment.createdAt,
    updatedAt: updatedComment.updatedAt,
    author: {
      id: updatedComment.user.id,
      name: updatedComment.user.name,
      avatar: updatedComment.user.imageUrl || null,
    },
  };
};

const deleteComment = async (
  commentId: string,
  userId: string,
  role: SystemRole,
) => {
  const comment = await getCommentById(commentId);
  await getTaskAccessContext(comment.taskId, userId);

  const canDelete =
    comment.userId === userId ||
    role === SystemRole.ADMIN ||
    role === SystemRole.SUPER_ADMIN;

  if (!canDelete) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to delete this comment.",
    );
  }

  const { organizationId } = await getTaskAccessContext(comment.taskId, userId);

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  await createActivity({
    organizationId,
    userId,
    entityType: ActivityEntity.COMMENT,
    entityId: comment.id,
    action: ActivityAction.DELETE,
    metadata: { taskId: comment.taskId },
  });
};

export const CommentServices = {
  createComment,
  getTaskComments,
  updateComment,
  deleteComment,
};
