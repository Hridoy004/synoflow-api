import type { Request } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TaskServices } from "./task.service";

const userId = (req: Request) => {
	if (!req.user?.userId)
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing in the request.",
		);
	return req.user.userId;
};

const param = (req: Request, name: "projectId" | "taskId") => {
	const value = req.params[name];
	if (typeof value !== "string")
		throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${name}.`);
	return value;
};

const createTask = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Task created successfully",
		data: await TaskServices.createTask(
			param(req, "projectId"),
			userId(req),
			req.body,
		),
	}),
);

const getProjectTasks = catchAsync(async (req, res) => {
	const result = await TaskServices.getProjectTasks(
		param(req, "projectId"),
		userId(req),
		req.query,
	);
	return sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Tasks retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getTask = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task retrieved successfully",
		data: await TaskServices.getTask(param(req, "taskId"), userId(req)),
	}),
);

const updateTask = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task updated successfully",
		data: await TaskServices.updateTask(
			param(req, "taskId"),
			userId(req),
			req.body,
		),
	}),
);

const deleteTask = catchAsync(async (req, res) => {
	await TaskServices.deleteTask(param(req, "taskId"), userId(req));
	return sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task deleted successfully",
		data: null,
	});
});

const updateTaskStatus = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task status updated successfully",
		data: await TaskServices.updateTaskStatus(
			param(req, "taskId"),
			userId(req),
			req.body,
		),
	}),
);

const updateTaskPriority = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task priority updated successfully",
		data: await TaskServices.updateTaskPriority(
			param(req, "taskId"),
			userId(req),
			req.body,
		),
	}),
);

const updateTaskAssignee = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task assignee updated successfully",
		data: await TaskServices.updateTaskAssignee(
			param(req, "taskId"),
			userId(req),
			req.body,
		),
	}),
);

const createSubtask = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Subtask created successfully",
		data: await TaskServices.createSubtask(
			param(req, "taskId"),
			userId(req),
			req.body,
		),
	}),
);

const getSubtasks = catchAsync(async (req, res) => {
	const result = await TaskServices.getSubtasks(
		param(req, "taskId"),
		userId(req),
		req.query,
	);
	return sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Subtasks retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const moveTask = catchAsync(async (req, res) =>
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task moved successfully",
		data: await TaskServices.moveTask(
			param(req, "taskId"),
			userId(req),
			req.body,
		),
	}),
);

export const TaskController = {
	createTask,
	getProjectTasks,
	getTask,
	updateTask,
	deleteTask,
	updateTaskStatus,
	updateTaskPriority,
	updateTaskAssignee,
	createSubtask,
	getSubtasks,
	moveTask,
};
