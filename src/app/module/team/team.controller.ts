import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TeamServices } from "./team.service";

const getUserId = (req: Request) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request.",
    );
  }
  return req.user.userId;
};

const getParam = (
  req: Request,
  name: "organizationId" | "teamId" | "userId",
) => {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${name}.`);
  }
  return value;
};

const createTeam = catchAsync(async (req: Request, res: Response) => {
  const result = await TeamServices.createTeam(
    getParam(req, "organizationId"),
    getUserId(req),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Team created successfully",
    data: result,
  });
});

const getOrganizationTeams = catchAsync(async (req: Request, res: Response) => {
  const result = await TeamServices.getOrganizationTeams(
    getParam(req, "organizationId"),
    getUserId(req),
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Teams retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getTeam = catchAsync(async (req: Request, res: Response) => {
  const result = await TeamServices.getTeamDetails(
    getParam(req, "teamId"),
    getUserId(req),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team retrieved successfully",
    data: result,
  });
});

const updateTeam = catchAsync(async (req: Request, res: Response) => {
  const result = await TeamServices.updateTeam(
    getParam(req, "teamId"),
    getUserId(req),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team updated successfully",
    data: result,
  });
});

const deleteTeam = catchAsync(async (req: Request, res: Response) => {
  await TeamServices.deleteTeam(getParam(req, "teamId"), getUserId(req));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team deleted successfully",
    data: null,
  });
});

const addTeamMember = catchAsync(async (req: Request, res: Response) => {
  const result = await TeamServices.addTeamMember(
    getParam(req, "teamId"),
    getUserId(req),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Team member added successfully",
    data: result,
  });
});

const getTeamMembers = catchAsync(async (req: Request, res: Response) => {
  const result = await TeamServices.getTeamMembers(
    getParam(req, "teamId"),
    getUserId(req),
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team members retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const removeTeamMember = catchAsync(async (req: Request, res: Response) => {
  await TeamServices.removeTeamMember(
    getParam(req, "teamId"),
    getUserId(req),
    getParam(req, "userId"),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team member removed successfully",
    data: null,
  });
});

export const TeamController = {
  createTeam,
  getOrganizationTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  getTeamMembers,
  removeTeamMember,
};
