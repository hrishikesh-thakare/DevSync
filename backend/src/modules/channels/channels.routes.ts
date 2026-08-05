import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireWorkspaceRole } from '../../middleware/roles.js';
import {
  createChannel,
  listChannels,
  getChannel,
  joinChannel,
  leaveChannel,
  archiveChannel,
  deleteChannel,
  updateChannel,
} from './channels.controller.js';

import messagesRoutes from '../messages/messages.routes.js';

// Mounted at /api/workspaces/:workspaceId/channels
const router = Router({ mergeParams: true });

// All channel routes require auth + workspace membership
router.use(requireAuth);
router.use(requireWorkspaceRole(['owner', 'admin', 'member']));

// ─── Channel Management ──────────────────────────────────────────────────────
router.post('/', requireWorkspaceRole(['owner', 'admin']), createChannel);
router.get('/', listChannels);
router.get('/:channelId', getChannel);
router.post('/:channelId/join', joinChannel);
router.delete('/:channelId/leave', leaveChannel);
router.patch('/:channelId/archive', requireWorkspaceRole(['owner', 'admin']), archiveChannel);
router.patch('/:channelId', requireWorkspaceRole(['owner', 'admin']), updateChannel);
router.delete('/:channelId', requireWorkspaceRole(['owner', 'admin']), deleteChannel);

// ─── Messages (Nested) ───────────────────────────────────────────────────────
router.use('/:channelId/messages', messagesRoutes);

export default router;
