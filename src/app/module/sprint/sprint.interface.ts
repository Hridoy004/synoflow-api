export interface ICreateSprintPayload {
	name: string;
	goal?: string | null;
	startDate?: Date | null;
	endDate?: Date | null;
}

export interface IUpdateSprintPayload {
	name?: string;
	goal?: string | null;
	startDate?: Date | null;
	endDate?: Date | null;
}

export interface ISprintQuery {
	page?: string;
	limit?: string;
}
