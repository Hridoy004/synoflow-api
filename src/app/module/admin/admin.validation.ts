import { z } from "zod";
import {
	ActivityAction,
	ActivityEntity,
	OrganizationStatus,
	ProjectStatus,
	SubscriptionPlan,
	SubscriptionStatus,
	SystemRole,
	UserStatus,
} from "../../../generated/prisma/enums";

const optionalPage = z
	.string()
	.regex(/^[1-9]\d*$/, "page must be a positive integer")
	.optional();
const optionalLimit = z
	.string()
	.regex(/^[1-9]\d*$/, "limit must be a positive integer")
	.refine((value) => value === undefined || Number(value) <= 100, {
		message: "limit must not exceed 100",
	})
	.optional();
const optionalId = z.string().uuid().optional();
const optionalDate = z
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)), {
		message: "date must be a valid ISO date",
	})
	.optional();

const updateUserRoleSchema = z.object({
	systemRole: z.enum(
		[SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN],
		{
			error: "systemRole must be USER, ADMIN, or SUPER_ADMIN",
		},
	),
});

const userQuerySchema = z.object({
	page: optionalPage,
	limit: optionalLimit,
	search: z.string().trim().max(100).optional(),
	status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED]).optional(),
	systemRole: z
		.enum([SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN])
		.optional(),
});

const organizationQuerySchema = z.object({
	page: optionalPage,
	limit: optionalLimit,
	search: z.string().trim().max(100).optional(),
	status: z
		.enum([OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED])
		.optional(),
});

const projectQuerySchema = z.object({
	page: optionalPage,
	limit: optionalLimit,
	search: z.string().trim().max(100).optional(),
	status: z
		.enum([
			ProjectStatus.PLANNING,
			ProjectStatus.ACTIVE,
			ProjectStatus.ON_HOLD,
			ProjectStatus.COMPLETED,
			ProjectStatus.ARCHIVED,
		])
		.optional(),
});

const subscriptionQuerySchema = z.object({
	page: optionalPage,
	limit: optionalLimit,
	search: z.string().trim().max(100).optional(),
	status: z
		.enum([
			SubscriptionStatus.PENDING,
			SubscriptionStatus.ACTIVE,
			SubscriptionStatus.PAST_DUE,
			SubscriptionStatus.CANCELLED,
			SubscriptionStatus.EXPIRED,
		])
		.optional(),
	plan: z
		.enum([
			SubscriptionPlan.FREE,
			SubscriptionPlan.PRO,
			SubscriptionPlan.BUSINESS,
		])
		.optional(),
});

const auditLogQuerySchema = z
	.object({
		page: optionalPage,
		limit: optionalLimit,
		organizationId: optionalId,
		userId: optionalId,
		entityType: z
			.enum([
				ActivityEntity.USER,
				ActivityEntity.ORGANIZATION,
				ActivityEntity.TEAM,
				ActivityEntity.PROJECT,
				ActivityEntity.SPRINT,
				ActivityEntity.TASK,
				ActivityEntity.COMMENT,
				ActivityEntity.PAYMENT,
				ActivityEntity.SUBSCRIPTION,
			])
			.optional(),
		action: z
			.enum([
				ActivityAction.CREATE,
				ActivityAction.UPDATE,
				ActivityAction.DELETE,
				ActivityAction.ASSIGN,
				ActivityAction.UNASSIGN,
				ActivityAction.STATUS_CHANGE,
				ActivityAction.ROLE_CHANGE,
				ActivityAction.MEMBER_ADDED,
				ActivityAction.MEMBER_REMOVED,
				ActivityAction.PAYMENT_SUCCESS,
				ActivityAction.PAYMENT_FAILED,
			])
			.optional(),
		from: optionalDate,
		to: optionalDate,
	})
	.refine(
		({ from, to }) =>
			!from || !to || new Date(from).getTime() <= new Date(to).getTime(),
		{ message: "from must be before or equal to to", path: ["from"] },
	);

export const AdminValidation = {
	updateUserRoleSchema,
	userQuerySchema,
	organizationQuerySchema,
	projectQuerySchema,
	subscriptionQuerySchema,
	auditLogQuerySchema,
};
