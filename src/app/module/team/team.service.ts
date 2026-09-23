import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
	OrganizationRole,
	OrganizationStatus,
	UserStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IAddTeamMemberPayload,
	ICreateTeamPayload,
	ITeamQuery,
	IUpdateTeamPayload,
} from "./team.interface";

const teamSelect = {
	id: true,
	name: true,
	description: true,
	organizationId: true,
	createdAt: true,
	updatedAt: true,
} as const;

const safeUserSelect = {
	id: true,
	name: true,
	email: true,
	imageUrl: true,
} as const;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getActiveOrganization = async (organizationId: string) => {
	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
			status: OrganizationStatus.ACTIVE,
			deletedAt: null,
		},
		select: { id: true, name: true, slug: true },
	});

	if (!organization) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found.");
	}

	return organization;
};

const getOrganizationMembership = async (
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
		select: { role: true },
	});

	if (!membership) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not a member of this organization.",
		);
	}

	return membership;
};

const assertOwner = async (organizationId: string, userId: string) => {
	const membership = await getOrganizationMembership(organizationId, userId);

	if (membership.role !== OrganizationRole.OWNER) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only the organization owner can perform this action.",
		);
	}
};

const getTeam = async (teamId: string) => {
	const team = await prisma.team.findFirst({
		where: {
			id: teamId,
			deletedAt: null,
			organization: {
				status: OrganizationStatus.ACTIVE,
				deletedAt: null,
			},
		},
		select: {
			...teamSelect,
			organization: { select: { id: true, name: true, slug: true } },
		},
	});

	if (!team) {
		throw new AppError(httpStatus.NOT_FOUND, "Team not found.");
	}

	return team;
};

const createTeam = async (
	organizationId: string,
	userId: string,
	payload: ICreateTeamPayload,
) => {
	await getActiveOrganization(organizationId);
	await assertOwner(organizationId, userId);

	try {
		return await prisma.team.create({
			data: { ...payload, organizationId },
			select: teamSelect,
		});
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			throw new AppError(
				httpStatus.CONFLICT,
				"A team with this name already exists in the organization.",
			);
		}
		throw error;
	}
};

const getOrganizationTeams = async (
	organizationId: string,
	userId: string,
	query: ITeamQuery,
) => {
	await getActiveOrganization(organizationId);
	await getOrganizationMembership(organizationId, userId);

	const page = parsePositiveInt(query.page, 1);
	const limit = Math.min(parsePositiveInt(query.limit, 10), 100);
	const where = { organizationId, deletedAt: null };

	const [data, total] = await Promise.all([
		prisma.team.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: { createdAt: "desc" },
			select: teamSelect,
		}),
		prisma.team.count({ where }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getTeamDetails = async (teamId: string, userId: string) => {
	const team = await getTeam(teamId);
	await getOrganizationMembership(team.organizationId, userId);
	return team;
};

const updateTeam = async (
	teamId: string,
	userId: string,
	payload: IUpdateTeamPayload,
) => {
	const team = await getTeam(teamId);
	await assertOwner(team.organizationId, userId);

	try {
		return await prisma.team.update({
			where: { id: teamId },
			data: payload,
			select: teamSelect,
		});
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			throw new AppError(
				httpStatus.CONFLICT,
				"A team with this name already exists in the organization.",
			);
		}
		throw error;
	}
};

const deleteTeam = async (teamId: string, userId: string) => {
	const team = await getTeam(teamId);
	await assertOwner(team.organizationId, userId);

	await prisma.team.update({
		where: { id: teamId },
		data: { deletedAt: new Date() },
	});
};

const addTeamMember = async (
	teamId: string,
	userId: string,
	payload: IAddTeamMemberPayload,
) => {
	const team = await getTeam(teamId);
	await assertOwner(team.organizationId, userId);

	const targetMembership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId: team.organizationId,
				userId: payload.userId,
			},
		},
		select: { user: { select: safeUserSelect } },
	});

	if (!targetMembership || !targetMembership.user) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User is not a member of this organization.",
		);
	}

	const user = await prisma.user.findFirst({
		where: {
			id: payload.userId,
			isDeleted: false,
			status: UserStatus.ACTIVE,
		},
		select: safeUserSelect,
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	try {
		return await prisma.teamMember.create({
			data: { teamId, userId: payload.userId },
			select: {
				id: true,
				teamId: true,
				createdAt: true,
				user: { select: safeUserSelect },
			},
		});
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			throw new AppError(httpStatus.CONFLICT, "User is already a team member.");
		}
		throw error;
	}
};

const getTeamMembers = async (
	teamId: string,
	userId: string,
	query: ITeamQuery,
) => {
	const team = await getTeam(teamId);
	await getOrganizationMembership(team.organizationId, userId);

	const page = parsePositiveInt(query.page, 1);
	const limit = Math.min(parsePositiveInt(query.limit, 10), 100);
	const where = { teamId };
	const [members, total] = await Promise.all([
		prisma.teamMember.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: { createdAt: "asc" },
			select: { userId: true, user: { select: safeUserSelect } },
		}),
		prisma.teamMember.count({ where }),
	]);

	return {
		data: members.map(({ userId: memberUserId, user }) => ({
			userId: memberUserId,
			name: user.name,
			email: user.email,
			avatar: user.imageUrl || null,
		})),
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const removeTeamMember = async (
	teamId: string,
	userId: string,
	targetUserId: string,
) => {
	const team = await getTeam(teamId);
	await assertOwner(team.organizationId, userId);

	const membership = await prisma.teamMember.findUnique({
		where: { teamId_userId: { teamId, userId: targetUserId } },
		select: { id: true },
	});

	if (!membership) {
		throw new AppError(httpStatus.NOT_FOUND, "Team member not found.");
	}

	await prisma.teamMember.delete({ where: { id: membership.id } });
};

export const TeamServices = {
	createTeam,
	getOrganizationTeams,
	getTeamDetails,
	updateTeam,
	deleteTeam,
	addTeamMember,
	getTeamMembers,
	removeTeamMember,
};
