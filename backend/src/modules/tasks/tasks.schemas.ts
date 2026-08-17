import { z } from 'zod';

// Match the database enums
const IssueTypeEnum = z.enum(['epic', 'story', 'task', 'bug', 'subtask']);
const StatusEnum = z.enum(['todo', 'in_progress', 'in_review', 'done']);
const PriorityEnum = z.enum(['critical', 'high', 'medium', 'low']);

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.any().optional(),
  descriptionText: z.string().optional(),
  issueType: IssueTypeEnum.optional(),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  labels: z.array(z.string()).optional(),
  parentTaskId: z.string().uuid().optional().nullable(),
  epicId: z.string().uuid().optional().nullable(),
  sprintId: z.string().uuid().optional().nullable(),
}).strict(); // Strip out extra fields

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Task title cannot be empty').optional(),
  description: z.any().optional(),
  descriptionText: z.string().optional(),
  issueType: IssueTypeEnum.optional(),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  labels: z.array(z.string()).optional(),
  parentTaskId: z.string().uuid().optional().nullable(),
  epicId: z.string().uuid().optional().nullable(),
  sprintId: z.string().uuid().optional().nullable(),
}).strict();

export const reorderTaskSchema = z.object({
  status: StatusEnum.optional(),
  afterTaskId: z.string().uuid().optional().nullable(),
  beforeTaskId: z.string().uuid().optional().nullable(),
}).strict();

const FiletypeEnum = z.enum(['image', 'pdf', 'code', 'video', 'audio', 'other']);

export const addTaskAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string().max(100).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  filetype: FiletypeEnum.optional(),
  fileBase64: z.string().min(1, 'fileBase64 is required'),
}).strict();
