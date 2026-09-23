export interface ICreateTeamPayload {
	name: string;
	description?: string;
}

export interface IUpdateTeamPayload {
	name?: string;
	description?: string | null;
}

export interface IAddTeamMemberPayload {
	userId: string;
}

export interface ITeamQuery {
	page?: string;
	limit?: string;
}
