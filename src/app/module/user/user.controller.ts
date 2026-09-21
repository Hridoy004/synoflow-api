import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { UpdateMyProfilePayload } from "./user.interface";
import { UserServices } from "./user.service";

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request",
    );
  }

  const result = await UserServices.updateMyProfile(
    userId,
    req.body as UpdateMyProfilePayload,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError(httpStatus.BAD_REQUEST, "No File Provided.");
  }

  const userId = req.user?.userId;

  const result = await UserServices.uploadProfileImage(
    req.file?.buffer,
    userId!,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile image uploaded successfully",
    data: result,
  });
});

export const UserController = {
  updateMyProfile,
  uploadProfileImage,
};
