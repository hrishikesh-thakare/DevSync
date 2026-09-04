import { z } from 'zod';

const ProjectStatusEnum = z.enum(['active', 'archived']);
const ProjectRoleEnum = z.enum(['project_admin', 'developer', 'viewer']);

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  key: z.string().min(1, 'Project key is required').max(10).toUpperCase(),
  description: z.string().optional(),
  iconUrl: z.string().optional(),
}).strict();

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name cannot be empty').optional(),
  description: z.string().optional(),
  iconUrl: z.string().optional(),
  status: ProjectStatusEnum.optional(),
}).strict();

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  role: ProjectRoleEnum,
}).strict();

export const updateProjectMemberRoleSchema = z.object({
  role: ProjectRoleEnum,
}).strict();
