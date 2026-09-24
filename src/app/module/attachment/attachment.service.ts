import httpStatus from "http-status";
import {
  ActivityAction,
  ActivityEntity,
  OrganizationStatus,
} from "../../../generated/prisma/enums";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { createActivity } from "../activity/activity.service";
import { PlanLimitService } from "../subscription/plan-limit.service";
import type { IAttachmentQuery } from "./attachment.interface";

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

const getAttachmentForDelete = async (attachmentId: string) => {
  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      deletedAt: null,
    },
    select: {
      id: true,
      taskId: true,
      userId: true,
      publicId: true,
      fileUrl: true,
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

  if (!attachment) {
    throw new AppError(httpStatus.NOT_FOUND, "Attachment not found.");
  }

  if (
    attachment.task.project.deletedAt ||
    attachment.task.project.organization.deletedAt ||
    attachment.task.project.organization.status !== OrganizationStatus.ACTIVE
  ) {
    throw new AppError(httpStatus.NOT_FOUND, "Attachment not found.");
  }

  return attachment;
};

const uploadAttachment = async (
  taskId: string,
  userId: string,
  file: Express.Multer.File,
) => {
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, "No file uploaded.");
  }

  const { organizationId } = await getTaskAccessContext(taskId, userId);

  await PlanLimitService.checkStorageLimit(organizationId, file.size ?? 0);

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Unsupported file type.");
  }

  const uploadResult = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: "auto" }, (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary upload failed"));
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      })
      .end(file.buffer);
  });

  let createdAttachment;
  try {
    createdAttachment = await prisma.attachment.create({
      data: {
        taskId,
        userId,
        fileName: file.originalname,
        fileUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        mimeType: file.mimetype,
        size: file.size,
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        mimeType: true,
        size: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });
  } catch (error) {
    await cloudinary.uploader
      .destroy(uploadResult.public_id)
      .catch(() => undefined);
    throw error;
  }

  await createActivity({
    organizationId,
    userId,
    entityType: ActivityEntity.TASK,
    entityId: taskId,
    action: ActivityAction.CREATE,
    metadata: {
      attachmentId: createdAttachment.id,
      fileName: createdAttachment.fileName,
      mimeType: createdAttachment.mimeType,
    },
  });

  return {
    id: createdAttachment.id,
    fileName: createdAttachment.fileName,
    fileUrl: createdAttachment.fileUrl,
    fileType: createdAttachment.mimeType,
    fileSize: createdAttachment.size,
    createdAt: createdAttachment.createdAt,
    uploader: {
      id: createdAttachment.user.id,
      name: createdAttachment.user.name,
      avatar: createdAttachment.user.imageUrl || null,
    },
  };
};

const getTaskAttachments = async (
  taskId: string,
  userId: string,
  query: IAttachmentQuery,
) => {
  await getTaskAccessContext(taskId, userId);

  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 20), 100);

  const [data, total] = await Promise.all([
    prisma.attachment.findMany({
      where: {
        taskId,
        deletedAt: null,
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        mimeType: true,
        size: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    }),
    prisma.attachment.count({
      where: {
        taskId,
        deletedAt: null,
      },
    }),
  ]);

  return {
    data: data.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileType: attachment.mimeType,
      fileSize: attachment.size,
      createdAt: attachment.createdAt,
      uploader: {
        id: attachment.user.id,
        name: attachment.user.name,
        avatar: attachment.user.imageUrl || null,
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

const deleteAttachment = async (attachmentId: string, userId: string) => {
  const attachment = await getAttachmentForDelete(attachmentId);

  const isOwner = attachment.userId === userId;
  const organizationMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: attachment.task.project.organizationId,
      userId,
      organization: {
        status: OrganizationStatus.ACTIVE,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  if (!isOwner && !organizationMembership) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to delete this attachment.",
    );
  }

  if (attachment.publicId) {
    await cloudinary.uploader
      .destroy(attachment.publicId)
      .catch(() => undefined);
  }

  await prisma.attachment.update({
    where: { id: attachmentId },
    data: { deletedAt: new Date() },
  });

  await createActivity({
    organizationId: attachment.task.project.organizationId,
    userId,
    entityType: ActivityEntity.TASK,
    entityId: attachment.taskId,
    action: ActivityAction.DELETE,
    metadata: { attachmentId: attachment.id, fileName: attachment.fileUrl },
  });
};

export const AttachmentServices = {
  uploadAttachment,
  getTaskAttachments,
  deleteAttachment,
};
