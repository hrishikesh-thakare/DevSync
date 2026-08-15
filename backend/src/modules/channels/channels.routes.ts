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

import { requireChannelAccess } from '../../middleware/channelAccess.js';
import { validate } from '../../middleware/validate.js';
import { createChannelSchema, updateChannelSchema } from './channels.schemas.js';

// Mounted at /api/workspaces/:workspaceId/channels
const router = Router({ mergeParams: true });

// All channel routes require auth + workspace membership
router.use(requireAuth);
router.use(requireWorkspaceRole(['owner', 'admin', 'member']));

// ─── Channel Management ──────────────────────────────────────────────────────
router.post('/', requireWorkspaceRole(['owner', 'admin']), validate(createChannelSchema), createChannel);
router.get('/', listChannels);
router.get('/:channelId', requireChannelAccess, getChannel);
router.post('/:channelId/join', requireChannelAccess, joinChannel);
router.delete('/:channelId/leave', requireChannelAccess, leaveChannel);
router.patch('/:channelId/archive', requireWorkspaceRole(['owner', 'admin']), requireChannelAccess, archiveChannel);
router.patch('/:channelId', requireWorkspaceRole(['owner', 'admin']), requireChannelAccess, validate(updateChannelSchema), updateChannel);
router.delete('/:channelId', requireWorkspaceRole(['owner', 'admin']), requireChannelAccess, deleteChannel);

// ─── Messages (Nested) ───────────────────────────────────────────────────────
router.use('/:channelId/messages', requireChannelAccess, messagesRoutes);

export default router;
