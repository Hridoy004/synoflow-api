import ejs from "ejs";
import httpStatus from "http-status";
import crypto from "node:crypto";
import path from "node:path";
import { Prisma } from "../../../generated/prisma/client";
import {
	OrganizationRole,
	OrganizationStatus,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { PlanLimitService } from "../subscription/plan-limit.service";
import type {
	IAcceptOrganizationInvitationPayload,
	IAddOrganizationMemberPayload,
	IInviteOrganizationMemberPayload,
	IOrganizationMemberQuery,
	IUpdateOrganizationMemberPayload,
} from "./organization-member.interface";

const invitationExpirationSeconds = 7 * 24 * 60 * 60;

const getInvitationKeys = (
	organizationId: string,
	email: string,
	tokenHash?: string,
) => ({
	indexKey: `organization-invitation-index:${organizationId}:${email}`,
	tokenKey: tokenHash ? `organization-invitation:${tokenHash}` : undefined,
});

const hashInvitationToken = (token: string) =>
	crypto.createHash("sha256").update(token).digest("hex");

const safeUserSelect = {
	id: true,
	name: true,
	email: true,
	imageUrl: true,
} as const;

const parsePositiveInt = (
	value: string | number | undefined,
	fallback: number,
) => {
	const parsed = Number(value);

	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const formatMember = (membership: {
	id: string;
	role: OrganizationRole;
	createdAt: Date;
	user: {
		id: string;
		name: string;
		email: string;
		imageUrl: string;
	};
}) => ({
	memberId: membership.id,
	user: {
		id: membership.user.id,
		name: membership.user.name,
		email: membership.user.email,
		avatar: membership.user.imageUrl || null,
	},
	role: membership.role,
	createdAt: membership.createdAt,
});

const getActiveOrganization = async (organizationId: string) => {
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

	return organization;
};

const getMembership = async (organizationId: string, userId: string) => {
	const membership = await prisma.organizationMember.findFirst({
		where: {
			organizationId,
			userId,
			organization: {
				status: OrganizationStatus.ACTIVE,
				deletedAt: null,
			},
		},
		select: { id: true, userId: true, role: true },
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
	const membership = await getMembership(organizationId, userId);

	if (membership.role !== OrganizationRole.OWNER) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only the organization owner can perform this action.",
		);
	}

	return membership;
};

const addMember = async (
	organizationId: string,
	userId: string,
	payload: IAddOrganizationMemberPayload,
) => {
	await getActiveOrganization(organizationId);
	await assertOwner(organizationId, userId);

	const member = await prisma.user.findFirst({
		where: {
			email: payload.email.toLowerCase(),
			isDeleted: false,
			status: UserStatus.ACTIVE,
		},
		select: { id: true, name: true, email: true, imageUrl: true },
	});

	if (!member) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	const existingMembership = await prisma.organizationMember.findUnique({
		where: {
			organizationId_userId: {
				organizationId,
				userId: member.id,
			},
		},
	});

	if (existingMembership) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User is already a member of this organization.",
		);
	}

	await PlanLimitService.checkMemberLimit(organizationId);

	try {
		const createdMembership = await prisma.organizationMember.create({
			data: {
				organizationId,
				userId: member.id,
				role: OrganizationRole.MEMBER,
			},
			select: {
				id: true,
				role: true,
				createdAt: true,
				user: { select: safeUserSelect },
			},
		});

		return formatMember(createdMembership);
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			throw new AppError(
				httpStatus.CONFLICT,
				"User is already a member of this organization.",
			);
		}
		throw error;
	}
};

const getMembers = async (
	organizationId: string,
	userId: string,
	query: IOrganizationMemberQuery,
) => {
	await getActiveOrganization(organizationId);
	await getMembership(organizationId, userId);

	const page = parsePositiveInt(query.page, 1);
	const limit = Math.min(parsePositiveInt(query.limit, 10), 100);
	const skip = (page - 1) * limit;
	const search = query.search;

	const where: Prisma.OrganizationMemberWhereInput = {
		organizationId,
		...(search
			? {
					user: {
						OR: [
							{ name: { contains: search, mode: "insensitive" } },
							{ email: { contains: search, mode: "insensitive" } },
						],
					},
				}
			: {}),
	};

	const [memberships, total] = await prisma.$transaction([
		prisma.organizationMember.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				role: true,
				createdAt: true,
				user: { select: safeUserSelect },
			},
		}),
		prisma.organizationMember.count({ where }),
	]);

	return {
		data: memberships.map(formatMember),
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const updateMember = async (
	organizationId: string,
	userId: string,
	memberId: string,
	_payload: IUpdateOrganizationMemberPayload,
) => {
	await getActiveOrganization(organizationId);
	await assertOwner(organizationId, userId);

	const targetMembership = await prisma.organizationMember.findFirst({
		where: { id: memberId, organizationId },
		select: { id: true, userId: true, role: true },
	});

	if (!targetMembership) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization member not found.");
	}

	if (targetMembership.role === OrganizationRole.OWNER) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"The organization owner role cannot be changed.",
		);
	}

	const updatedMembership = await prisma.organizationMember.findUniqueOrThrow({
		where: { id: targetMembership.id },
		select: {
			id: true,
			role: true,
			createdAt: true,
			user: { select: safeUserSelect },
		},
	});

	return formatMember(updatedMembership);
};

const removeMember = async (
	organizationId: string,
	userId: string,
	memberId: string,
) => {
	await getActiveOrganization(organizationId);
	await assertOwner(organizationId, userId);

	const targetMembership = await prisma.organizationMember.findFirst({
		where: { id: memberId, organizationId },
		select: { id: true, userId: true, role: true },
	});

	if (!targetMembership) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization member not found.");
	}

	if (targetMembership.userId === userId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"The organization owner cannot remove themselves.",
		);
	}

	if (targetMembership.role === OrganizationRole.OWNER) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"The organization owner cannot be removed.",
		);
	}

	await prisma.organizationMember.delete({
		where: { id: targetMembership.id },
	});
};

const inviteMember = async (
	organizationId: string,
	userId: string,
	payload: IInviteOrganizationMemberPayload,
) => {
	const organization = await prisma.organization.findFirst({
		where: {
			id: organizationId,
			status: OrganizationStatus.ACTIVE,
			deletedAt: null,
		},
		select: { id: true, name: true },
	});

	if (!organization) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found.");
	}

	await assertOwner(organizationId, userId);

	const email = payload.email.trim().toLowerCase();
	const existingUser = await prisma.user.findUnique({
		where: { email },
		select: { id: true },
	});

	if (existingUser) {
		const existingMembership = await prisma.organizationMember.findUnique({
			where: {
				organizationId_userId: {
					organizationId,
					userId: existingUser.id,
				},
			},
			select: { id: true },
		});

		if (existingMembership) {
			throw new AppError(
				httpStatus.CONFLICT,
				"User is already a member of this organization.",
			);
		}
	}

	const { indexKey } = getInvitationKeys(organizationId, email);
	const existingTokenHash = await redisClient.get(indexKey);

	if (existingTokenHash) {
		const existingInvitation = await redisClient.exists(
			getInvitationKeys(organizationId, email, existingTokenHash)
				.tokenKey as string,
		);

		if (existingInvitation) {
			throw new AppError(
				httpStatus.CONFLICT,
				"An invitation has already been sent to this email.",
			);
		}

		await redisClient.del(indexKey);
	}

	const token = crypto.randomBytes(32).toString("hex");
	const tokenHash = hashInvitationToken(token);
	const { tokenKey } = getInvitationKeys(organizationId, email, tokenHash);
	const invitation = {
		organizationId,
		email,
		inviterId: userId,
	};

	await redisClient.set(tokenKey as string, JSON.stringify(invitation), {
		expiration: { type: "EX", value: invitationExpirationSeconds },
	});
	await redisClient.set(indexKey, tokenHash, {
		expiration: { type: "EX", value: invitationExpirationSeconds },
	});

	try {
		const templatePath = path.join(
			process.cwd(),
			"src/app/templates/organization-invitation.ejs",
		);
		const invitationUrl = `${config.frontend_url ?? config.bak_url ?? "http://localhost:3000"}/organizations/${organizationId}/members/accept?token=${token}`;
		const html = await ejs.renderFile(templatePath, {
			organizationName: organization.name,
			invitationUrl,
			expirationDays: 7,
		});

		await transporter.sendMail({
			from: `"Synoflow" <${config.email_sender}>`,
			to: email,
			subject: `Invitation to join ${organization.name} on Synoflow`,
			html,
		});
	} catch (error) {
		await Promise.all([
			redisClient.del(tokenKey as string),
			redisClient.del(indexKey),
		]);
		throw error;
	}

	return { email, expiresInDays: 7 };
};

const acceptInvitation = async (
	organizationId: string,
	userId: string,
	userEmail: string,
	payload: IAcceptOrganizationInvitationPayload,
) => {
	const tokenHash = hashInvitationToken(payload.token.trim());
	const tokenKey = getInvitationKeys(
		organizationId,
		userEmail.trim().toLowerCase(),
		tokenHash,
	).tokenKey as string;
	const invitationData = await redisClient.get(tokenKey);

	if (!invitationData) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invitation is invalid or has expired.",
		);
	}

	const invitation: { organizationId: string; email: string } =
		JSON.parse(invitationData);
	const email = userEmail.trim().toLowerCase();

	if (
		invitation.organizationId !== organizationId ||
		invitation.email !== email
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"This invitation does not belong to the authenticated user.",
		);
	}

	await getActiveOrganization(organizationId);

	const existingMembership = await prisma.organizationMember.findUnique({
		where: { organizationId_userId: { organizationId, userId } },
		select: { id: true },
	});

	if (existingMembership) {
		throw new AppError(
			httpStatus.CONFLICT,
			"You are already a member of this organization.",
		);
	}

	const membership = await prisma.organizationMember.create({
		data: {
			organizationId,
			userId,
			role: OrganizationRole.MEMBER,
		},
		select: {
			id: true,
			role: true,
			createdAt: true,
			user: { select: safeUserSelect },
		},
	});

	await Promise.all([
		redisClient.del(tokenKey),
		redisClient.del(getInvitationKeys(organizationId, email).indexKey),
	]);

	return formatMember(membership);
};

export const OrganizationMemberServices = {
	addMember,
	getMembers,
	updateMember,
	removeMember,
	inviteMember,
	acceptInvitation,
};
