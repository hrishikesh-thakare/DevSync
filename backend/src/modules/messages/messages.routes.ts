import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { sendMessageSchema, editMessageSchema, addReactionSchema } from './messages.schemas.js';
// Channel membership is enforced by requireChannelAccess, which runs one
// level up in channels.routes.ts (router.use('/:channelId/messages', requireChannelAccess, messagesRoutes)).
// It verifies workspace membership, workspace owner/admin privileges, project
// membership for project-scoped channels, and explicit channel membership for
// private channels/DMs.

import {
  sendMessage,
  listMessages,
  getThreadReplies,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction
} from './messages.controller.js';

// Mounted at /api/channels/:channelId/messages
const router = Router({ mergeParams: true });

// All message routes require authentication
router.use(requireAuth);

router.post('/', validate(sendMessageSchema), sendMessage);
router.get('/', listMessages);
router.get('/:messageId/thread', getThreadReplies);
router.patch('/:messageId', validate(editMessageSchema), editMessage);
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/reactions', validate(addReactionSchema), addReaction);
router.delete('/:messageId/reactions/:emoji', removeReaction);

export default router;
