import { z } from 'zod';

const RoleEnum = z.enum(['owner', 'admin', 'member', 'guest']);

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
  slug: z.string().optional(),
  description: z.string().optional(),
  iconUrl: z.string().optional(),
}).strict();

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name cannot be empty').optional(),
  slug: z.string().min(1, 'Workspace slug cannot be empty').optional(),
  description: z.string().optional(),
  iconUrl: z.string().optional(),
}).strict();

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: RoleEnum.optional().default('member'),
}).strict();

export const updateMemberRoleSchema = z.object({
  role: RoleEnum,
}).strict();
