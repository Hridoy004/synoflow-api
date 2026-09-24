import type { Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { SubscriptionServices } from "./subscription.service";

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

const getSubscription = catchAsync(async (req, res) => {
  const data = await SubscriptionServices.getSubscription(
    getOrganizationId(req),
    getUserId(req),
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription retrieved successfully",
    data,
  });
});

const createSubscription = catchAsync(async (req, res) => {
  const data = await SubscriptionServices.createSubscription(
    getOrganizationId(req),
    getUserId(req),
    req.body,
  );

  return sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Subscription created successfully",
    data,
  });
});

const updateSubscription = catchAsync(async (req, res) => {
  const data = await SubscriptionServices.updateSubscription(
    getOrganizationId(req),
    getUserId(req),
    req.body,
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription updated successfully",
    data,
  });
});

const cancelSubscription = catchAsync(async (req, res) => {
  const data = await SubscriptionServices.cancelSubscription(
    getOrganizationId(req),
    getUserId(req),
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subscription cancellation scheduled successfully",
    data,
  });
});

export const SubscriptionController = {
  getSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
};
