import type { Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { LabelServices } from "./label.service";

const userId = (req: Request) => {
  if (!req.user?.userId)
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request.",
    );
  return req.user.userId;
};

const getParam = (
  req: Request,
  name: "organizationId" | "labelId" | "taskId",
) => {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${name}.`);
  }
  return value;
};

const createLabel = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Label created successfully",
    data: await LabelServices.createLabel(
      getParam(req, "organizationId"),
      userId(req),
      req.body,
    ),
  }),
);

const getOrganizationLabels = catchAsync(async (req, res) => {
  const result = await LabelServices.getOrganizationLabels(
    getParam(req, "organizationId"),
    userId(req),
    req.query,
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Labels retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const updateLabel = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Label updated successfully",
    data: await LabelServices.updateLabel(
      getParam(req, "labelId"),
      userId(req),
      req.body,
    ),
  }),
);

const deleteLabel = catchAsync(async (req, res) => {
  await LabelServices.deleteLabel(getParam(req, "labelId"), userId(req));

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Label deleted successfully",
    data: null,
  });
});

const attachLabelToTask = catchAsync(async (req, res) =>
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Label attached to task successfully",
    data: await LabelServices.attachLabelToTask(
      getParam(req, "taskId"),
      userId(req),
      req.body,
    ),
  }),
);

const detachLabelFromTask = catchAsync(async (req, res) => {
  await LabelServices.detachLabelFromTask(
    getParam(req, "taskId"),
    getParam(req, "labelId"),
    userId(req),
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Label detached from task successfully",
    data: null,
  });
});

export const LabelController = {
  createLabel,
  getOrganizationLabels,
  updateLabel,
  deleteLabel,
  attachLabelToTask,
  detachLabelFromTask,
};
