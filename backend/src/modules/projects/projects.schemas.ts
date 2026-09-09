import { z } from 'zod';

const ProjectRoleEnum = z.enum(['project_admin', 'developer', 'viewer']);

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  key: z.string().min(1, 'Project key is required').max(10).toUpperCase(),
  description: z.string().optional(),
  iconUrl: z.string().optional(),
}).strict();

// `status` deliberately excluded — this route is reachable by 'developer'
// (`requireProjectRole(['project_admin', 'developer'])`), while archiving a
// project is meant to be project_admin-only, as the dedicated
// `/:key/archive` route's own gate proves. Accepting `status` here let any
// developer archive or unarchive a project through this endpoint, bypassing
// that restriction entirely — same DB write, same audit action, just
// reached through a route that was never supposed to allow it. Archiving
// has exactly one path now: `/:key/archive` and `archiveProject`.
export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name cannot be empty').optional(),
  description: z.string().optional(),
  iconUrl: z.string().optional(),
}).strict();

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  role: ProjectRoleEnum,
}).strict();

export const updateProjectMemberRoleSchema = z.object({
  role: ProjectRoleEnum,
}).strict();
