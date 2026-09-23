export interface ICreateCommentPayload {
  content: string;
}

export interface IUpdateCommentPayload {
  content?: string;
}

export interface ICommentQuery {
  page?: number | string;
  limit?: number | string;
}
