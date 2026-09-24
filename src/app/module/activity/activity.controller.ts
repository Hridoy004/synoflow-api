import type { Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ActivityServices } from "./activity.service";

const getUserId = (req: Request) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request.",
    );
  }

  return req.user.userId;
};

const getOrganizationId = (req: Request) => {
  const { organizationId } = req.params;

  if (typeof organizationId !== "string") {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid organization ID.");
  }

  return organizationId;
};

const getTaskId = (req: Request) => {
  const { taskId } = req.params;

  if (typeof taskId !== "string") {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid task ID.");
  }

  return taskId;
};

const getOrganizationActivities = catchAsync(async (req, res) => {
  const result = await ActivityServices.getOrganizationActivities(
    getOrganizationId(req),
    getUserId(req),
    req.query,
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organization activities retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getTaskActivities = catchAsync(async (req, res) => {
  const result = await ActivityServices.getTaskActivities(
    getTaskId(req),
    getUserId(req),
    req.query,
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task activities retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const ActivityController = {
  getOrganizationActivities,
  getTaskActivities,
};
