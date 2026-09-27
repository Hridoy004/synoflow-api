import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TaskController } from "./task.controller";
import { TaskValidation } from "./task.validation";

const projectTaskRouter = Router({ mergeParams: true });
projectTaskRouter.post(
	"/",
	auth(),
	validateRequest(TaskValidation.createTaskSchema),
	TaskController.createTask,
);
projectTaskRouter.get(
	"/",
	auth(),
	validateRequest(TaskValidation.taskQuerySchema, "query"),
	TaskController.getProjectTasks,
);

const taskRouter = Router();
taskRouter.get("/:taskId", auth(), TaskController.getTask);
taskRouter.patch(
	"/:taskId",
	auth(),
	validateRequest(TaskValidation.updateTaskSchema),
	TaskController.updateTask,
);
taskRouter.delete("/:taskId", auth(), TaskController.deleteTask);
taskRouter.patch(
	"/:taskId/status",
	auth(),
	validateRequest(TaskValidation.statusSchema),
	TaskController.updateTaskStatus,
);
taskRouter.patch(
	"/:taskId/priority",
	auth(),
	validateRequest(TaskValidation.prioritySchema),
	TaskController.updateTaskPriority,
);
taskRouter.patch(
	"/:taskId/assignee",
	auth(),
	validateRequest(TaskValidation.assigneeSchema),
	TaskController.updateTaskAssignee,
);
taskRouter.post(
	"/:taskId/subtasks",
	auth(),
	validateRequest(TaskValidation.subtaskSchema),
	TaskController.createSubtask,
);
taskRouter.get(
	"/:taskId/subtasks",
	auth(),
	validateRequest(TaskValidation.taskQuerySchema, "query"),
	TaskController.getSubtasks,
);
taskRouter.patch(
	"/:taskId/move",
	auth(),
	validateRequest(TaskValidation.moveTaskSchema),
	TaskController.moveTask,
);

export const ProjectTaskRoutes = projectTaskRouter;
export const TaskRoutes = taskRouter;
