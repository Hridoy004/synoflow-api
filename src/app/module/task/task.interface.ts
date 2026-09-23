import type { TaskPriority, TaskStatus } from "../../../generated/prisma/enums";

export type TaskSortField =
  | "createdAt"
  | "updatedAt"
  | "title"
  | "priority"
  | "status"
  | "dueDate";

export type TaskSortOrder = "asc" | "desc";

export interface ICreateTaskPayload {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  sprintId?: string | null;
  dueDate?: Date | null;
  position?: number | null;
}

export interface IUpdateTaskPayload {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  sprintId?: string | null;
  dueDate?: Date | null;
  position?: number | null;
}

export interface ITaskStatusPayload {
  status: TaskStatus;
}

export interface ITaskPriorityPayload {
  priority: TaskPriority;
}

export interface ITaskAssigneePayload {
  assigneeId: string | null;
}

export interface ISubtaskPayload {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
  position?: number | null;
}

export interface IMoveTaskPayload {
  status?: TaskStatus;
  sprintId?: string | null;
  position?: number | null;
}

export interface ITaskQuery {
  page?: number | string;
  limit?: number | string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  sprintId?: string;
  search?: string;
  sortBy?: TaskSortField;
  sortOrder?: TaskSortOrder;
}
