export interface ICreateProjectPayload {
	name: string;
	key: string;
	description?: string;
	teamId?: string | null;
	startDate?: Date | null;
	dueDate?: Date | null;
}

export interface IUpdateProjectPayload {
	name?: string;
	key?: string;
	description?: string | null;
	teamId?: string | null;
	startDate?: Date | null;
	dueDate?: Date | null;
}

export interface IProjectMemberPayload {
	userId: string;
}

export interface IProjectQuery {
	page?: string;
	limit?: string;
	search?: string;
}
