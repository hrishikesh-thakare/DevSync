import { z } from 'zod';

// 'guest' used to be accepted here with no role check anywhere in the app
// ever granting it anything — inviting or demoting someone to it silently
// locked them out of the whole workspace (every `requireWorkspaceRole` guard
// lists 'owner' | 'admin' | 'member' and would reject 'guest' at every route).
// Removed rather than half-implemented: add it back only alongside real
// guest-tier permissions.
const RoleEnum = z.enum(['owner', 'admin', 'member']);

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
