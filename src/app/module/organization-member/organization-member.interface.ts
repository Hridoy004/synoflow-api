export interface IAddOrganizationMemberPayload {
	email: string;
	role: "MEMBER";
}

export interface IUpdateOrganizationMemberPayload {
	role: "MEMBER";
}

export interface IInviteOrganizationMemberPayload {
	email: string;
}

export interface IAcceptOrganizationInvitationPayload {
	token: string;
}

export interface IOrganizationMemberParams {
	organizationId: string;
	memberId?: string;
}

export interface IOrganizationMemberQuery {
	page?: number;
	limit?: number;
	search?: string;
}
