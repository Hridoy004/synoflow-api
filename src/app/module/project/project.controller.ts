import type { Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ProjectServices } from "./project.service";

const userId = (req: Request) => {
	if (!req.user?.userId)
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing in the request.",
		);
	return req.user.userId;
};
const param = (
	req: Request,
	name: "organizationId" | "projectId" | "userId",
) => {
	const value = req.params[name];
	if (typeof value !== "string")
		throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${name}.`);
	return value;
};

const createProject = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Project created successfully",
		data: await ProjectServices.createProject(
			param(req, "organizationId"),
			userId(req),
			req.body,
		),
	}),
);
const getOrganizationProjects = catchAsync(async (req, res) => {
	const result = await ProjectServices.getOrganizationProjects(
		param(req, "organizationId"),
		userId(req),
		req.query,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Projects retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});
const getProject = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project retrieved successfully",
		data: await ProjectServices.getProject(
			param(req, "projectId"),
			userId(req),
		),
	}),
);
const updateProject = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project updated successfully",
		data: await ProjectServices.updateProject(
			param(req, "projectId"),
			userId(req),
			req.body,
		),
	}),
);
const deleteProject = catchAsync(async (req, res) => {
	await ProjectServices.deleteProject(param(req, "projectId"), userId(req));
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project deleted successfully",
		data: null,
	});
});
const addProjectMember = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Project member added successfully",
		data: await ProjectServices.addProjectMember(
			param(req, "projectId"),
			userId(req),
			req.body,
		),
	}),
);
const getProjectMembers = catchAsync(async (req, res) => {
	const result = await ProjectServices.getProjectMembers(
		param(req, "projectId"),
		userId(req),
		req.query,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project members retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});
const removeProjectMember = catchAsync(async (req, res) => {
	await ProjectServices.removeProjectMember(
		param(req, "projectId"),
		userId(req),
		param(req, "userId"),
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project member removed successfully",
		data: null,
	});
});

export const ProjectController = {
	createProject,
	getOrganizationProjects,
	getProject,
	updateProject,
	deleteProject,
	addProjectMember,
	getProjectMembers,
	removeProjectMember,
};
