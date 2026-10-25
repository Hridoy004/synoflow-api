import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
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

const getOrganizations = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await AdminServices.getOrganizations(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organizations retrieved successfully",
		data,
		meta,
	});
});

const getProjects = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await AdminServices.getProjects(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Projects retrieved successfully",
		data,
		meta,
	});
});

const getSubscriptions = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await AdminServices.getSubscriptions(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Subscriptions retrieved successfully",
		data,
		meta,
	});
});

const updateUserRole = catchAsync(async (req: Request, res: Response) => {
	const actor = req.user;
	if (!actor) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required.");
	}

	const targetUserId = req.params.id;
	if (typeof targetUserId !== "string") {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid user ID.");
	}

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
	getOrganizations,
	getProjects,
	getSubscriptions,
	updateUserRole,
	getDashboardStats,
	getAuditLogs,
};
