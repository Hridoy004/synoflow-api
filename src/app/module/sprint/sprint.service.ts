import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
	OrganizationRole,
	OrganizationStatus,
	SprintStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICreateSprintPayload,
	ISprintQuery,
	IUpdateSprintPayload,
} from "./sprint.interface";

const sprintSelect = {
	id: true,
	projectId: true,
	name: true,
	goal: true,
	startDate: true,
	endDate: true,
	status: true,
	createdAt: true,
	updatedAt: true,
} as const;
const parsePositiveInt = (value: string | undefined, fallback: number) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getMembership = async (organizationId: string, userId: string) => {
	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId,
			userId,
			organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
		},
		select: { role: true },
	});
	if (!membership)
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not a member of this organization.",
		);
	return membership;
};
const assertOwner = async (organizationId: string, userId: string) => {
	const membership = await getMembership(organizationId, userId);
	if (membership.role !== OrganizationRole.OWNER)
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only the organization owner can perform this action.",
		);
};
const getProject = async (projectId: string) => {
	const project = await prisma.project.findFirst({
		where: {
			id: projectId,
			deletedAt: null,
			organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
		},
		select: { id: true, organizationId: true },
	});
	if (!project) throw new AppError(httpStatus.NOT_FOUND, "Project not found.");
	return project;
};
const getSprintRecord = async (sprintId: string) => {
	const sprint = await prisma.sprint.findFirst({
		where: {
			id: sprintId,
			deletedAt: null,
			project: {
				deletedAt: null,
				organization: { status: OrganizationStatus.ACTIVE, deletedAt: null },
			},
		},
		select: {
			...sprintSelect,
			project: { select: { id: true, name: true, organizationId: true } },
		},
	});
	if (!sprint) throw new AppError(httpStatus.NOT_FOUND, "Sprint not found.");
	return sprint;
};
const assertDates = (startDate?: Date | null, endDate?: Date | null) => {
	if (startDate && endDate && startDate > endDate)
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Sprint end date must be on or after its start date.",
		);
};

const assertUniqueSprintName = async (
	projectId: string,
	name: string,
	excludeSprintId?: string,
) => {
	const existingSprint = await prisma.sprint.findFirst({
		where: {
			projectId,
			name,
			deletedAt: null,
			...(excludeSprintId ? { id: { not: excludeSprintId } } : {}),
		},
		select: { id: true },
	});
	if (existingSprint)
		throw new AppError(
			httpStatus.CONFLICT,
			"A sprint with this name already exists in the project.",
		);
};

const createSprint = async (
	projectId: string,
	userId: string,
	payload: ICreateSprintPayload,
) => {
	const project = await getProject(projectId);
	await assertOwner(project.organizationId, userId);
	assertDates(payload.startDate, payload.endDate);
	await assertUniqueSprintName(projectId, payload.name);
	try {
		return await prisma.sprint.create({
			data: { ...payload, projectId },
			select: sprintSelect,
		});
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		)
			throw new AppError(
				httpStatus.CONFLICT,
				"A sprint with this name already exists.",
			);
		throw error;
	}
};

const getProjectSprints = async (
	projectId: string,
	userId: string,
	query: ISprintQuery,
) => {
	const project = await getProject(projectId);
	await getMembership(project.organizationId, userId);
	const page = parsePositiveInt(query.page, 1);
	const limit = Math.min(parsePositiveInt(query.limit, 10), 100);
	const where = { projectId, deletedAt: null };
	const [data, total] = await Promise.all([
		prisma.sprint.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: { createdAt: "desc" },
			select: sprintSelect,
		}),
		prisma.sprint.count({ where }),
	]);
	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getSprint = async (sprintId: string, userId: string) => {
	const sprint = await getSprintRecord(sprintId);
	await getMembership(sprint.project.organizationId, userId);
	return sprint;
};

const updateSprint = async (
	sprintId: string,
	userId: string,
	payload: IUpdateSprintPayload,
) => {
	const sprint = await getSprintRecord(sprintId);
	await assertOwner(sprint.project.organizationId, userId);
	if (
		sprint.status === SprintStatus.COMPLETED ||
		sprint.status === SprintStatus.CANCELLED
	)
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"A completed or cancelled sprint cannot be updated.",
		);
	assertDates(
		payload.startDate ?? sprint.startDate,
		payload.endDate ?? sprint.endDate,
	);
	if (payload.name) {
		await assertUniqueSprintName(sprint.projectId, payload.name, sprintId);
	}
	return prisma.sprint.update({
		where: { id: sprintId },
		data: payload,
		select: sprintSelect,
	});
};

const deleteSprint = async (sprintId: string, userId: string) => {
	const sprint = await getSprintRecord(sprintId);
	await assertOwner(sprint.project.organizationId, userId);
	if (sprint.status !== SprintStatus.PLANNED)
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Only a planned sprint can be deleted.",
		);
	await prisma.sprint.update({
		where: { id: sprintId },
		data: { deletedAt: new Date() },
	});
};

const startSprint = async (sprintId: string, userId: string) => {
	const sprint = await getSprintRecord(sprintId);
	await assertOwner(sprint.project.organizationId, userId);
	if (sprint.status !== SprintStatus.PLANNED)
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Only a planned sprint can be started.",
		);
	const updated = await prisma.sprint.updateMany({
		where: { id: sprintId, status: SprintStatus.PLANNED, deletedAt: null },
		data: { status: SprintStatus.ACTIVE },
	});
	if (updated.count !== 1)
		throw new AppError(
			httpStatus.CONFLICT,
			"Sprint state changed; please retry.",
		);
	return prisma.sprint.findUniqueOrThrow({
		where: { id: sprintId },
		select: sprintSelect,
	});
};

const completeSprint = async (sprintId: string, userId: string) => {
	const sprint = await getSprintRecord(sprintId);
	await assertOwner(sprint.project.organizationId, userId);
	if (sprint.status !== SprintStatus.ACTIVE)
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Only an active sprint can be completed.",
		);
	const updated = await prisma.sprint.updateMany({
		where: { id: sprintId, status: SprintStatus.ACTIVE, deletedAt: null },
		data: { status: SprintStatus.COMPLETED },
	});
	if (updated.count !== 1)
		throw new AppError(
			httpStatus.CONFLICT,
			"Sprint state changed; please retry.",
		);
	return prisma.sprint.findUniqueOrThrow({
		where: { id: sprintId },
		select: sprintSelect,
	});
};

export const SprintServices = {
	createSprint,
	getProjectSprints,
	getSprint,
	updateSprint,
	deleteSprint,
	startSprint,
	completeSprint,
};
