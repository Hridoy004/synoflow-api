import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	type ActivityAction,
	type ActivityEntity,
	OrganizationStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IActivityQuery } from "./activity.interface";

const parsePositiveInt = (
	value: number | string | undefined,
	fallback: number,
) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const assertOrganizationAccess = async (
	organizationId: string,
	userId: string,
) => {
	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId,
			userId,
			organization: {
				status: OrganizationStatus.ACTIVE,
				deletedAt: null,
			},
		},
		select: { id: true },
	});

	if (!membership) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have access to this organization.",
		);
	}

	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
			status: OrganizationStatus.ACTIVE,
			deletedAt: null,
		},
		select: { id: true },
	});

	if (!organization) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found.");
	}
};

const assertTaskAccess = async (taskId: string, userId: string) => {
	const task = await prisma.task.findFirst({
		where: {
			id: taskId,
			deletedAt: null,
		},
		select: {
			id: true,
			projectId: true,
			project: {
				select: {
					id: true,
					organizationId: true,
					deletedAt: true,
					organization: {
						select: {
							id: true,
							status: true,
							deletedAt: true,
						},
					},
				},
			},
		},
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found.");
	}

	if (
		task.project.deletedAt ||
		task.project.organization.deletedAt ||
		task.project.organization.status !== OrganizationStatus.ACTIVE
	) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found.");
	}

	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId: task.project.organizationId,
			userId,
			organization: {
				status: OrganizationStatus.ACTIVE,
				deletedAt: null,
			},
		},
		select: { id: true },
	});

	const projectMembership = await prisma.projectMember.findUnique({
		where: {
			projectId_userId: {
				projectId: task.projectId,
				userId,
			},
		},
		select: { id: true },
	});

	if (!membership && !projectMembership) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have access to this task.",
		);
	}

	return task.project.organizationId;
};

const buildActivityWhere = (query: IActivityQuery, organizationId?: string) => {
	const where: Prisma.ActivityWhereInput = {};

	if (organizationId) {
		where.organizationId = organizationId;
	}

	if (query.actorId) {
		where.userId = query.actorId;
	}

	if (query.action) {
		where.action = query.action;
	}

	if (query.entityType) {
		where.entityType = query.entityType;
	}

	if (query.entityId) {
		where.entityId = query.entityId;
	}

	return where;
};

export type CreateActivityInput = {
	organizationId: string;
	userId: string;
	entityType: ActivityEntity;
	entityId: string;
	action: ActivityAction;
	metadata?: Record<string, unknown> | null;
};

export const createActivity = async (
	{
		organizationId,
		userId,
		entityType,
		entityId,
		action,
		metadata,
	}: CreateActivityInput,
	tx?: Prisma.TransactionClient,
) => {
	if (!organizationId || !userId || !entityId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Activity payload is incomplete.",
		);
	}

	const client = tx ?? prisma;

	return client.activity.create({
		data: {
			organizationId,
			userId,
			entityType,
			entityId,
			action,
			metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
		},
	});
};

const getOrganizationActivities = async (
	organizationId: string,
	userId: string,
	query: IActivityQuery,
) => {
	await assertOrganizationAccess(organizationId, userId);

	const page = parsePositiveInt(query.page, 1);
	const limit = Math.min(parsePositiveInt(query.limit, 20), 100);

	const where = buildActivityWhere(query, organizationId);

	const [data, total] = await Promise.all([
		prisma.activity.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				action: true,
				entityType: true,
				entityId: true,
				metadata: true,
				createdAt: true,
				user: {
					select: {
						id: true,
						name: true,
						imageUrl: true,
					},
				},
			},
		}),
		prisma.activity.count({ where }),
	]);

	return {
		data: data.map((activity) => ({
			id: activity.id,
			action: activity.action,
			entityType: activity.entityType,
			entityId: activity.entityId,
			metadata: activity.metadata,
			createdAt: activity.createdAt,
			actor: {
				id: activity.user.id,
				name: activity.user.name,
				avatar: activity.user.imageUrl || null,
			},
		})),
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getTaskActivities = async (
	taskId: string,
	userId: string,
	query: IActivityQuery,
) => {
	const organizationId = await assertTaskAccess(taskId, userId);

	const page = parsePositiveInt(query.page, 1);
	const limit = Math.min(parsePositiveInt(query.limit, 20), 100);

	const where = buildActivityWhere(query, organizationId);
	where.entityId = taskId;

	const [data, total] = await Promise.all([
		prisma.activity.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				action: true,
				entityType: true,
				entityId: true,
				metadata: true,
				createdAt: true,
				user: {
					select: {
						id: true,
						name: true,
						imageUrl: true,
					},
				},
			},
		}),
		prisma.activity.count({ where }),
	]);

	return {
		data: data.map((activity) => ({
			id: activity.id,
			action: activity.action,
			entityType: activity.entityType,
			entityId: activity.entityId,
			metadata: activity.metadata,
			createdAt: activity.createdAt,
			actor: {
				id: activity.user.id,
				name: activity.user.name,
				avatar: activity.user.imageUrl || null,
			},
		})),
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

export const ActivityServices = {
	createActivity,
	getOrganizationActivities,
	getTaskActivities,
};
