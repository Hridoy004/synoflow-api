import type {
  ActivityAction,
  ActivityEntity,
  SystemRole,
  UserStatus,
} from "../../../generated/prisma/enums";

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
