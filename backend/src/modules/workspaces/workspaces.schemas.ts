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

// Deliberately narrower than `RoleEnum` — 'owner' is excluded on purpose.
// This route is gated to `requireWorkspaceRole(['owner', 'admin'])`, so
// without this restriction any admin (not just the real owner) could invite
// or reactivate someone straight into a co-owner role, or silently promote
// an existing deactivated member to owner on reactivation. Granting
// ownership has exactly one legitimate path: `updateMemberRole`, which is
// correctly locked to `requireWorkspaceRole(['owner'])` alone.
const InvitableRole = z.enum(['admin', 'member']);

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: InvitableRole.optional().default('member'),
}).strict();

export const updateMemberRoleSchema = z.object({
  role: RoleEnum,
}).strict();
