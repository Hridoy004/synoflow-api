import type {
	ActivityAction,
	ActivityEntity,
} from "../../../generated/prisma/enums";

export interface IActivityQuery {
	page?: number | string;
	limit?: number | string;
	actorId?: string;
	action?: ActivityAction;
	entityType?: ActivityEntity;
	entityId?: string;
}
