import type { ContactStatus } from "../../../generated/prisma/enums";
import type { CreateContactInput } from "./contact.validation";

export type ICreateContactPayload = CreateContactInput;

export interface IContactQuery {
	page?: number | string;
	limit?: number | string;
	status?: ContactStatus;
	inquiryType?: string;
	search?: string;
}
