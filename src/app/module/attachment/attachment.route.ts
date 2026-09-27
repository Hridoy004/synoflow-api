import { Router } from "express";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AttachmentController } from "./attachment.controller";
import { AttachmentValidation } from "./attachment.validation";

const taskAttachmentRouter = Router({ mergeParams: true });
taskAttachmentRouter.post(
	"/",
	auth(),
	upload.single("file"),
	AttachmentController.createAttachment,
);
taskAttachmentRouter.get(
	"/",
	auth(),
	validateRequest(AttachmentValidation.attachmentQuerySchema, "query"),
	AttachmentController.getTaskAttachments,
);

const attachmentRouter = Router();
attachmentRouter.delete(
	"/:attachmentId",
	auth(),
	AttachmentController.deleteAttachment,
);

export const TaskAttachmentRoutes = taskAttachmentRouter;
export const AttachmentRoutes = attachmentRouter;
