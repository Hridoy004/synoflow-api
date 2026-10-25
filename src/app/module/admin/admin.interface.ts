import type {
	ActivityAction,
	ActivityEntity,
	OrganizationStatus,
	ProjectStatus,
	SubscriptionPlan,
	SubscriptionStatus,
	SystemRole,
	UserStatus,
} from "../../../generated/prisma/enums";

export interface IAdminPaginationQuery {
	page?: string;
	limit?: string;
	search?: string;
}

export interface IAdminUserQuery {
	page?: string;
	limit?: string;
	search?: string;
	status?: UserStatus;
	systemRole?: SystemRole;
}

export interface IUpdateUserRolePayload {
	systemRole: SystemRole;
}

export interface IAdminAuditLogQuery {
	page?: string;
	limit?: string;
	organizationId?: string;
	userId?: string;
	entityType?: ActivityEntity;
	action?: ActivityAction;
	from?: string;
	to?: string;
}

export interface IAdminOrganizationQuery extends IAdminPaginationQuery {
	status?: OrganizationStatus;
}

export interface IAdminProjectQuery extends IAdminPaginationQuery {
	status?: ProjectStatus;
}

export interface IAdminSubscriptionQuery extends IAdminPaginationQuery {
	status?: SubscriptionStatus;
	plan?: SubscriptionPlan;
}
