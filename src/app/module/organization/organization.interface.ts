export interface ICreateOrganizationPayload {
  name: string;
  slug: string;
  description?: string;
}

export interface IUpdateOrganizationPayload {
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface IOrganizationIdParams {
  organizationId: string;
}

export interface IOrganizationQuery {
  page?: string;
  limit?: string;
  sortBy?: "createdAt" | "updatedAt" | "name" | "slug";
  sortOrder?: "asc" | "desc";
}
