import z from "zod";
import { TaskPriority, TaskStatus } from "../../../generated/prisma/enums";

const uuid = z.uuid("Invalid ID.");
const date = z.coerce.date();

const taskSortFields = [
  "createdAt",
  "updatedAt",
  "title",
  "priority",
  "status",
  "dueDate",
] as const;

const taskFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  assigneeId: uuid.nullable().optional(),
  sprintId: uuid.nullable().optional(),
  dueDate: date.nullable().optional(),
  position: z.number().int().nonnegative().nullable().optional(),
};

const createTaskSchema = z
  .object({
    title: taskFields.title,
    description: taskFields.description,
    status: taskFields.status,
    priority: taskFields.priority,
    assigneeId: taskFields.assigneeId,
    sprintId: taskFields.sprintId,
    dueDate: taskFields.dueDate,
    position: taskFields.position,
  })
  .strict();

const updateTaskSchema = z
  .object({
    title: taskFields.title.optional(),
    description: taskFields.description,
    assigneeId: taskFields.assigneeId,
    sprintId: taskFields.sprintId,
    dueDate: taskFields.dueDate,
    position: taskFields.position,
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required for update.",
  });

const statusSchema = z.object({ status: z.nativeEnum(TaskStatus) }).strict();
const prioritySchema = z
  .object({ priority: z.nativeEnum(TaskPriority) })
  .strict();
const assigneeSchema = z.object({ assigneeId: uuid.nullable() }).strict();

const subtaskSchema = z
  .object({
    title: taskFields.title,
    description: taskFields.description,
    status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
    assigneeId: taskFields.assigneeId,
    dueDate: taskFields.dueDate,
    position: taskFields.position,
  })
  .strict();

const moveTaskSchema = z
  .object({
    status: z.nativeEnum(TaskStatus).optional(),
    sprintId: uuid.nullable().optional(),
    position: taskFields.position,
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required to move the task.",
  });

const taskQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    assigneeId: uuid.optional(),
    sprintId: uuid.optional(),
    search: z.string().trim().max(200).optional(),
    sortBy: z.enum(taskSortFields).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .strict();

export const TaskValidation = {
  createTaskSchema,
  updateTaskSchema,
  statusSchema,
  prioritySchema,
  assigneeSchema,
  subtaskSchema,
  moveTaskSchema,
  taskQuerySchema,
};
