import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminServices } from "./admin.service";

const getUsers = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await AdminServices.getUsers(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully",
    data,
    meta,
  });
});

const updateUserRole = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user!;
  const targetUserId = req.params.id as string;

  const data = await AdminServices.updateUserRole(
    actor.userId,
    targetUserId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User role updated successfully",
    data,
  });
});

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
  const data = await AdminServices.getDashboardStats();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard stats retrieved successfully",
    data,
  });
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await AdminServices.getAuditLogs(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs retrieved successfully",
    data,
    meta,
  });
});

export const AdminController = {
  getUsers,
  updateUserRole,
  getDashboardStats,
  getAuditLogs,
};
