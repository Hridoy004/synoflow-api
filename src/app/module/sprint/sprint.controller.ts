import type { Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { SprintServices } from "./sprint.service";

const userId = (req: Request) => {
  if (!req.user?.userId)
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request.",
    );
  return req.user.userId;
};
const param = (req: Request, name: "projectId" | "sprintId") => {
  const value = req.params[name];
  if (typeof value !== "string")
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${name}.`);
  return value;
};
const createSprint = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Sprint created successfully",
    data: await SprintServices.createSprint(
      param(req, "projectId"),
      userId(req),
      req.body,
    ),
  }),
);
const getProjectSprints = catchAsync(async (req, res) => {
  const result = await SprintServices.getProjectSprints(
    param(req, "projectId"),
    userId(req),
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprints retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});
const getSprint = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprint retrieved successfully",
    data: await SprintServices.getSprint(param(req, "sprintId"), userId(req)),
  }),
);
const updateSprint = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprint updated successfully",
    data: await SprintServices.updateSprint(
      param(req, "sprintId"),
      userId(req),
      req.body,
    ),
  }),
);
const deleteSprint = catchAsync(async (req, res) => {
  await SprintServices.deleteSprint(param(req, "sprintId"), userId(req));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprint deleted successfully",
    data: null,
  });
});
const startSprint = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprint started successfully",
    data: await SprintServices.startSprint(param(req, "sprintId"), userId(req)),
  }),
);
const completeSprint = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprint completed successfully",
    data: await SprintServices.completeSprint(
      param(req, "sprintId"),
      userId(req),
    ),
  }),
);

export const SprintController = {
  createSprint,
  getProjectSprints,
  getSprint,
  updateSprint,
  deleteSprint,
  startSprint,
  completeSprint,
};
