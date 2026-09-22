import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { OrganizationMemberServices } from "./organization-member.service";

const getUserId = (req: Request) => {
  if (!req.user?.userId) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request.",
    );
  }

  return req.user.userId;
};

const getParam = (req: Request, name: "organizationId" | "memberId") => {
  const value = req.params[name];

  if (typeof value !== "string") {
    throw new AppError(httpStatus.BAD_REQUEST, `Invalid ${name}.`);
  }

  return value;
};

const addMember = catchAsync(async (req: Request, res: Response) => {
  const result = await OrganizationMemberServices.addMember(
    getParam(req, "organizationId"),
    getUserId(req),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Organization member added successfully",
    data: result,
  });
});

const getMembers = catchAsync(async (req: Request, res: Response) => {
  const result = await OrganizationMemberServices.getMembers(
    getParam(req, "organizationId"),
    getUserId(req),
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organization members retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const updateMember = catchAsync(async (req: Request, res: Response) => {
  const result = await OrganizationMemberServices.updateMember(
    getParam(req, "organizationId"),
    getUserId(req),
    getParam(req, "memberId"),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organization member updated successfully",
    data: result,
  });
});

const removeMember = catchAsync(async (req: Request, res: Response) => {
  await OrganizationMemberServices.removeMember(
    getParam(req, "organizationId"),
    getUserId(req),
    getParam(req, "memberId"),
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Member removed successfully",
    data: null,
  });
});

const inviteMember = catchAsync(async (req: Request, res: Response) => {
  const result = await OrganizationMemberServices.inviteMember(
    getParam(req, "organizationId"),
    getUserId(req),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organization invitation sent successfully",
    data: result,
  });
});

const acceptInvitation = catchAsync(async (req: Request, res: Response) => {
  const result = await OrganizationMemberServices.acceptInvitation(
    getParam(req, "organizationId"),
    getUserId(req),
    req.user?.email ?? "",
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Organization invitation accepted successfully",
    data: result,
  });
});

export const OrganizationMemberController = {
  addMember,
  getMembers,
  updateMember,
  removeMember,
  inviteMember,
  acceptInvitation,
};
