import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { OrganizationServices } from "./organization.service";

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

const createOrganization = catchAsync(async (req: Request, res: Response) => {
	const result = await OrganizationServices.createOrganization(
		getUserId(req),
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Organization created successfully",
		data: result,
	});
});

const getMyOrganizations = catchAsync(async (req: Request, res: Response) => {
	const result = await OrganizationServices.getMyOrganizations(
		getUserId(req),
		req.query,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organizations retrieved successfully",
		data: result,
	});
});

const getOrganization = catchAsync(async (req: Request, res: Response) => {
	const result = await OrganizationServices.getOrganization(
		getOrganizationId(req),
		getUserId(req),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization retrieved successfully",
		data: result,
	});
});

const updateOrganization = catchAsync(async (req: Request, res: Response) => {
	const result = await OrganizationServices.updateOrganization(
		getOrganizationId(req),
		getUserId(req),
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization updated successfully",
		data: result,
	});
});

const deleteOrganization = catchAsync(async (req: Request, res: Response) => {
	await OrganizationServices.deleteOrganization(
		getOrganizationId(req),
		getUserId(req),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization deleted successfully",
		data: null,
	});
});

export const OrganizationController = {
	createOrganization,
	getMyOrganizations,
	getOrganization,
	updateOrganization,
	deleteOrganization,
};
