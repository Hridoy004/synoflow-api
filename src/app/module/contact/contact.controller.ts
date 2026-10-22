import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ContactServices } from "./contact.service";

const createContact = catchAsync(async (req: Request, res: Response) => {
  const data = await ContactServices.createContact(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Contact submission received successfully",
    data: data,
  });
});

const getContacts = catchAsync(async (req: Request, res: Response) => {
  const result = await ContactServices.getContacts(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact submissions retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getContactById = catchAsync(async (req: Request, res: Response) => {
  const data = await ContactServices.getContactById(
    req.params.contactId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact submission retrieved successfully",
    data: data,
  });
});

const deleteContact = catchAsync(async (req: Request, res: Response) => {
  await ContactServices.deleteContact(req.params.contactId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact submission deleted successfully",
    data: null,
  });
});

export const ContactController = {
  createContact,
  getContacts,
  getContactById,
  deleteContact,
};
