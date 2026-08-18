import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/roles.js';
import { listLabels, createLabel, updateLabel, deleteLabel } from './labels.controller.js';
import { validate } from '../../middleware/validate.js';
import { createLabelSchema, updateLabelSchema } from './labels.schemas.js';

// Mounted at /api/projects/:projectId/labels
const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', requireProjectRole(['project_admin', 'developer', 'viewer']), listLabels);
router.post('/', requireProjectRole(['project_admin', 'developer']), validate(createLabelSchema), createLabel);
router.patch('/:labelId', requireProjectRole(['project_admin', 'developer']), validate(updateLabelSchema), updateLabel);
router.delete('/:labelId', requireProjectRole(['project_admin']), deleteLabel);

export default router;