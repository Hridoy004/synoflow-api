import type { Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CommentServices } from "./comment.service";

const userId = (req: Request) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request.",
    );
  }
  return req.user.userId;
};

const reqRole = (req: Request) => req.user?.role ?? "USER";

const getParam = (req: Request, name: "taskId" | "commentId") => {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${name}.`);
  }
  return value;
};

const createComment = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Comment created successfully",
    data: await CommentServices.createComment(
      getParam(req, "taskId"),
      userId(req),
      req.body,
    ),
  }),
);

const getTaskComments = catchAsync(async (req, res) => {
  const result = await CommentServices.getTaskComments(
    getParam(req, "taskId"),
    userId(req),
    req.query,
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task comments retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const updateComment = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment updated successfully",
    data: await CommentServices.updateComment(
      getParam(req, "commentId"),
      userId(req),
      reqRole(req),
      req.body,
    ),
  }),
);

const deleteComment = catchAsync(async (req, res) => {
  await CommentServices.deleteComment(
    getParam(req, "commentId"),
    userId(req),
    reqRole(req),
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment deleted successfully",
    data: null,
  });
});

export const CommentController = {
  createComment,
  getTaskComments,
  updateComment,
  deleteComment,
};
