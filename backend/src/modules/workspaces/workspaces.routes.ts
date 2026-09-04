import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireWorkspaceRole } from '../../middleware/roles.js';
import {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaceMembers,
  inviteMember,
  acceptInvite,
  updateMemberRole,
  removeMember,
  leaveWorkspace,
  getMyTasks,
} from './workspaces.controller.js';
import { unfurlUrl } from './unfurl.controller.js';
import { unfurlLimiter } from '../../middleware/rateLimit.js';
import { resolveSlug } from '../../middleware/slugs.js';
import { validate } from '../../middleware/validate.js';
import { createWorkspaceSchema, updateWorkspaceSchema, inviteMemberSchema, updateMemberRoleSchema } from './workspaces.schemas.js';

const router = Router();

// Register param resolver for slug
router.param('slug', resolveSlug);

// All workspace routes require authentication
router.use(requireAuth);

// ─── Workspace Utilities ───────────────────────────────────────────────────────
router.get('/:slug/unfurl', unfurlLimiter, requireWorkspaceRole(['owner', 'admin', 'member']), unfurlUrl);
router.get('/:slug/my-tasks', requireWorkspaceRole(['owner', 'admin', 'member']), getMyTasks);

// ─── Workspace CRUD ──────────────────────────────────────────────────────────
router.post('/', validate(createWorkspaceSchema), createWorkspace);
router.get('/', listWorkspaces);
router.get('/:slug', requireWorkspaceRole(['owner', 'admin', 'member']), getWorkspace);
router.patch('/:slug', requireWorkspaceRole(['owner', 'admin']), validate(updateWorkspaceSchema), updateWorkspace);
router.delete('/:slug', requireWorkspaceRole(['owner']), deleteWorkspace);

// ─── Member Management ──────────────────────────────────────────────────────
router.get('/:slug/members', requireWorkspaceRole(['owner', 'admin', 'member']), listWorkspaceMembers);
router.post('/:slug/invite', requireWorkspaceRole(['owner', 'admin']), validate(inviteMemberSchema), inviteMember);
router.post('/:slug/invites/accept', acceptInvite); // No workspace role required, just auth
router.patch('/:slug/members/:userId', requireWorkspaceRole(['owner']), validate(updateMemberRoleSchema), updateMemberRole);
// Self-service leave — must be registered before members/:userId
router.delete('/:slug/members/me', leaveWorkspace);
router.delete('/:slug/members/:userId', requireWorkspaceRole(['owner', 'admin']), removeMember);

export default router;
