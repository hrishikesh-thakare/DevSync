import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireWorkspaceRole } from '../../middleware/roles.js';
import { resolveSlug } from '../../middleware/slugs.js';
import { globalSearch } from './search.controller.js';

const router = Router({ mergeParams: true });

router.param('slug', resolveSlug);
router.use(requireAuth);
router.use(requireWorkspaceRole(['owner', 'admin', 'member']));
router.get('/', globalSearch);

export default router;
