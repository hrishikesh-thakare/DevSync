import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole } from '../../middleware/roles.js';
import { runGithubWebhookEventForTest } from './internal-test.controller.js';

// Mounted at: /api/workspaces/:slug/projects/:key/internal-test
// Test-only surface for exercising backend logic that real GitHub webhook
// delivery can't reach in CI (no public URL for GitHub to call back into).
// index.ts only mounts this router when NODE_ENV !== 'production'.
export const internalTestRouter = Router({ mergeParams: true });

internalTestRouter.use(requireAuth);
internalTestRouter.use(requireProjectRole(['project_admin']));
internalTestRouter.post('/github-webhook-event', runGithubWebhookEventForTest);
