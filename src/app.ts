import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import {
  OrganizationActivityRoutes,
  TaskActivityRoutes,
} from "./app/module/activity/activity.route";
import {
  AttachmentRoutes,
  TaskAttachmentRoutes,
} from "./app/module/attachment/attachment.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import {
  CommentRoutes,
  TaskCommentRoutes,
} from "./app/module/comment/comment.route";
import { LabelRoutes, TaskLabelRoutes } from "./app/module/label/label.route";
import { OrganizationRoutes } from "./app/module/organization/organization.route";
import { ProjectRoutes } from "./app/module/project/project.route";
import {
  ProjectSprintRoutes,
  SprintRoutes,
} from "./app/module/sprint/sprint.route";
import { ProjectTaskRoutes, TaskRoutes } from "./app/module/task/task.route";
import { TeamRoutes } from "./app/module/team/team.route";
import { UserRoutes } from "./app/module/user/user.route";

const app: Application = express();

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/organizations", OrganizationRoutes);
app.use(
  "/api/v1/organizations/:organizationId/activities",
  OrganizationActivityRoutes,
);
app.use("/api/v1/teams", TeamRoutes);
app.use("/api/v1/projects", ProjectRoutes);
app.use("/api/v1/projects/:projectId/tasks", ProjectTaskRoutes);
app.use("/api/v1/projects/:projectId/sprints", ProjectSprintRoutes);
app.use("/api/v1/tasks", TaskRoutes);
app.use("/api/v1/tasks/:taskId/labels", TaskLabelRoutes);
app.use("/api/v1/tasks/:taskId/activities", TaskActivityRoutes);
app.use("/api/v1/tasks/:taskId/comments", TaskCommentRoutes);
app.use("/api/v1/tasks/:taskId/attachments", TaskAttachmentRoutes);
app.use("/api/v1/comments", CommentRoutes);
app.use("/api/v1/attachments", AttachmentRoutes);
app.use("/api/v1/labels", LabelRoutes);
app.use("/api/v1/sprints", SprintRoutes);

// app.get("/test", async (req: Request, res: Response, next: NextFunction) => {
// 	try {
// 		const grantIdTokenResult = await getBkashIdToken();

// 		console.log(grantIdTokenResult);

// 		res.status(httpStatus.OK).json({
// 			success: true,
// 			message: "Welcome to PH Healthcare System Backend",
// 			data: null,
// 		});
// 	} catch (error) {
// 		console.log(error);
// 		next(error);
// 	}
// });

app.get("/", async (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to Synoflow Backend",
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
