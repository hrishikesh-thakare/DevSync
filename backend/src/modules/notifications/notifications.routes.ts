import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  resolveNotification,
} from './notifications.controller.js';

const router = Router();

// All notification routes require authentication
router.use(requireAuth);

router.get('/', getMyNotifications);
router.patch('/read-all', markAllAsRead); // Must be placed before /:notificationId
router.patch('/:notificationId/read', markAsRead);
router.get('/:notificationId/resolve', resolveNotification);

export default router;
