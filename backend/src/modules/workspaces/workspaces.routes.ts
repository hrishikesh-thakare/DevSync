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
} from './workspaces.controller.js';
import { unfurlUrl } from './unfurl.controller.js';
import { resolveSlug } from '../../middleware/slugs.js';

const router = Router();

// Register param resolver for slug
router.param('slug', resolveSlug);

// All workspace routes require authentication
router.use(requireAuth);

// ─── Workspace Utilities ───────────────────────────────────────────────────────
router.get('/:slug/unfurl', requireWorkspaceRole(['owner', 'admin', 'member']), unfurlUrl);

// ─── Workspace CRUD ──────────────────────────────────────────────────────────
router.post('/', createWorkspace);
router.get('/', listWorkspaces);
router.get('/:slug', requireWorkspaceRole(['owner', 'admin', 'member']), getWorkspace);
router.patch('/:slug', requireWorkspaceRole(['owner', 'admin']), updateWorkspace);
router.delete('/:slug', requireWorkspaceRole(['owner']), deleteWorkspace);

// ─── Member Management ──────────────────────────────────────────────────────
router.get('/:slug/members', requireWorkspaceRole(['owner', 'admin', 'member']), listWorkspaceMembers);
router.post('/:slug/invite', requireWorkspaceRole(['owner', 'admin']), inviteMember);
router.post('/:slug/invites/accept', acceptInvite); // No workspace role required, just auth
router.patch('/:slug/members/:userId', requireWorkspaceRole(['owner']), updateMemberRole);
router.delete('/:slug/members/:userId', requireWorkspaceRole(['owner', 'admin']), removeMember);

export default router;
