import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { ICreateContactPayload, IContactQuery } from "./contact.interface";

const publicContactSelect = {
	id: true,
	inquiryType: true,
	status: true,
	createdAt: true,
} as const;

const createContact = async (payload: ICreateContactPayload) => {
	return prisma.contactSubmission.create({
		data: {
			name: payload.name,
			email: payload.email,
			inquiryType: payload.inquiryType,
			organization: payload.organization ?? null,
			subject: payload.subject,
			message: payload.message,
		},
		select: publicContactSelect,
	});
};

const getContacts = async (query: IContactQuery) => {
	const page = Number(query.page ?? 1);
	const limit = Number(query.limit ?? 20);
	const { status, inquiryType, search } = query;
	const where = {
		...(status ? { status } : {}),
		...(inquiryType ? { inquiryType } : {}),
		...(search
			? {
					OR: [
						{ name: { contains: search, mode: "insensitive" as const } },
						{ email: { contains: search, mode: "insensitive" as const } },
						{ subject: { contains: search, mode: "insensitive" as const } },
					],
				}
			: {}),
	};

	const [data, total] = await Promise.all([
		prisma.contactSubmission.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.contactSubmission.count({ where }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getContactById = async (contactId: string) => {
	const contact = await prisma.contactSubmission.findUnique({
		where: { id: contactId },
	});

	if (!contact) {
		throw new AppError(httpStatus.NOT_FOUND, "Contact submission not found.");
	}

	return contact;
};

const deleteContact = async (contactId: string) => {
	const { count } = await prisma.contactSubmission.deleteMany({
		where: { id: contactId },
	});

	if (count === 0) {
		throw new AppError(httpStatus.NOT_FOUND, "Contact submission not found.");
	}
};

export const ContactServices = {
	createContact,
	getContacts,
	getContactById,
	deleteContact,
};
