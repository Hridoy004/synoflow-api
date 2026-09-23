import type { Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AttachmentServices } from "./attachment.service";

const userId = (req: Request) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request.",
    );
  }
  return req.user.userId;
};

const getParam = (req: Request, name: "taskId" | "attachmentId") => {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${name}.`);
  }
  return value;
};

const createAttachment = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Attachment uploaded successfully",
    data: await AttachmentServices.uploadAttachment(
      getParam(req, "taskId"),
      userId(req),
      req.file as Express.Multer.File,
    ),
  }),
);

const getTaskAttachments = catchAsync(async (req, res) => {
  const result = await AttachmentServices.getTaskAttachments(
    getParam(req, "taskId"),
    userId(req),
    req.query,
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task attachments retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const deleteAttachment = catchAsync(async (req, res) => {
  await AttachmentServices.deleteAttachment(
    getParam(req, "attachmentId"),
    userId(req),
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachment deleted successfully",
    data: null,
  });
});

export const AttachmentController = {
  createAttachment,
  getTaskAttachments,
  deleteAttachment,
};
