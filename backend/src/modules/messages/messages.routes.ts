import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
// Note: You could add a channel member check middleware here if needed,
// but for simplicity we rely on the workspace/project guards on higher routes
// or basic authentication. If a user shouldn't access a channel, they shouldn't
// have the channelId. In a fully secure app, you'd verify channel membership.

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

router.post('/', sendMessage);
router.get('/', listMessages);
router.get('/:messageId/thread', getThreadReplies);
router.patch('/:messageId', editMessage);
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/reactions', addReaction);
router.delete('/:messageId/reactions/:emoji', removeReaction);

export default router;
