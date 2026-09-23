export interface ICreateLabelPayload {
  name: string;
  color?: string | null;
}

export interface IUpdateLabelPayload {
  name?: string;
  color?: string | null;
}

export interface IAttachLabelPayload {
  labelId: string;
}

export interface ILabelQuery {
  page?: number | string;
  limit?: number | string;
  search?: string;
  sortBy?: "name" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}
