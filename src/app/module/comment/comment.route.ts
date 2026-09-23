import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CommentController } from "./comment.controller";
import { CommentValidation } from "./comment.validation";

const taskCommentRouter = Router({ mergeParams: true });
taskCommentRouter.post(
  "/",
  auth(),
  validateRequest(CommentValidation.createCommentSchema),
  CommentController.createComment,
);
taskCommentRouter.get(
  "/",
  auth(),
  validateRequest(CommentValidation.commentQuerySchema, "query"),
  CommentController.getTaskComments,
);

const commentRouter = Router();
commentRouter.patch(
  "/:commentId",
  auth(),
  validateRequest(CommentValidation.updateCommentSchema),
  CommentController.updateComment,
);
commentRouter.delete("/:commentId", auth(), CommentController.deleteComment);

export const TaskCommentRoutes = taskCommentRouter;
export const CommentRoutes = commentRouter;
