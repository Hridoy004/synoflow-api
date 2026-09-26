import type { Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentServices } from "./payment.service";

const getUserId = (req: Request) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request.",
    );
  }

  return req.user.userId;
};

const createCheckout = catchAsync(async (req, res) => {
  const data = await PaymentServices.createCheckout(
    getUserId(req),
    req.body.subscriptionId,
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment checkout created successfully.",
    data,
  });
});

const checkout = createCheckout;

const getPayments = catchAsync(async (req, res) => {
  const organizationId = req.query.organizationId as string | undefined;

  if (!organizationId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Organization ID is required.");
  }

  const data = await PaymentServices.getPayments(
    organizationId,
    getUserId(req),
  );

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved successfully.",
    data,
  });
});

const getPayment = catchAsync(async (req, res) => {
  const paymentId = Array.isArray(req.params.paymentId)
    ? req.params.paymentId[0]
    : req.params.paymentId;

  const data = await PaymentServices.getPayment(paymentId, getUserId(req));

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment retrieved successfully.",
    data,
  });
});

const webhook = catchAsync(async (req, res) => {
  const data = await PaymentServices.processWebhook(req.body);

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment webhook processed successfully.",
    data,
  });
});

export const PaymentController = {
  createCheckout,
  checkout,
  getPayments,
  getPayment,
  webhook,
};
