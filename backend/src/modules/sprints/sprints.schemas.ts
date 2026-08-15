import { z } from 'zod';

export const createSprintSchema = z.object({
  name: z.string().min(1, 'Sprint name is required'),
  goal: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable().or(z.date().optional()),
  endDate: z.string().datetime().optional().nullable().or(z.date().optional()),
}).strict();

export const updateSprintSchema = z.object({
  name: z.string().min(1, 'Sprint name cannot be empty').optional(),
  goal: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable().or(z.date().optional()),
  endDate: z.string().datetime().optional().nullable().or(z.date().optional()),
}).strict();

export const startSprintSchema = z.object({
  startDate: z.string().datetime().optional().nullable().or(z.date().optional()),
  endDate: z.string().datetime().optional().nullable().or(z.date().optional()),
}).strict();

export const addTaskToSprintSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
}).strict();
