import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/roles.js';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  reorderTask,
  deleteTask,
  getTaskComments,
  createTaskComment,
  listTaskAttachments,
  addTaskAttachment,
  deleteTaskAttachment,
} from './tasks.controller.js';

import { resolveTaskKey } from '../../middleware/slugs.js';
import { validate } from '../../middleware/validate.js';
import { createTaskSchema, updateTaskSchema, reorderTaskSchema, addTaskAttachmentSchema } from './tasks.schemas.js';

// Mounted at /api/projects/:projectId/tasks
const router = Router({ mergeParams: true });

router.param('taskKey', resolveTaskKey);

// All task routes require auth + project membership
router.use(requireAuth);

// ─── Task CRUD ───────────────────────────────────────────────────────────────
router.post('/', requireProjectRole(['project_admin', 'developer']), validate(createTaskSchema), createTask);
router.get('/', requireProjectRole(['project_admin', 'developer', 'viewer']), listTasks);
router.get('/:taskKey', requireProjectRole(['project_admin', 'developer', 'viewer']), getTask);
router.patch('/:taskKey', requireProjectRole(['project_admin', 'developer']), validate(updateTaskSchema), updateTask);
router.patch('/:taskKey/reorder', requireProjectRole(['project_admin', 'developer']), validate(reorderTaskSchema), reorderTask);
router.delete('/:taskKey', requireProjectRole(['project_admin']), deleteTask);

// ─── Task Comments ───────────────────────────────────────────────────────────
router.get('/:taskKey/comments', requireProjectRole(['project_admin', 'developer', 'viewer']), getTaskComments);
router.post('/:taskKey/comments', requireProjectRole(['project_admin', 'developer']), createTaskComment);

// ─── Task Attachments ────────────────────────────────────────────────────────
router.get('/:taskKey/attachments', requireProjectRole(['project_admin', 'developer', 'viewer']), listTaskAttachments);
router.post('/:taskKey/attachments', requireProjectRole(['project_admin', 'developer']), validate(addTaskAttachmentSchema), addTaskAttachment);
router.delete('/:taskKey/attachments/:fileId', requireProjectRole(['project_admin', 'developer']), deleteTaskAttachment);

export default router;
