import z from "zod";

const uuid = z.uuid("Invalid ID.");

const createCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(5000),
  })
  .strict();

const updateCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(5000),
  })
  .strict();

const commentQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export const CommentValidation = {
  createCommentSchema,
  updateCommentSchema,
  commentQuerySchema,
  commentIdParams: z.object({ commentId: uuid }).strict(),
  taskIdParams: z.object({ taskId: uuid }).strict(),
};
