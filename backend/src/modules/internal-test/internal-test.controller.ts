import { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { processGithubWebhookEvent } from '../github/github.controller.js';

/**
 * Test-only endpoint that runs the GitHub webhook processing logic directly,
 * bypassing HTTP delivery, HMAC signature verification, and the job queue.
 *
 * It exists because CI runners (and most local dev setups without a tunnel)
 * have no URL GitHub's servers can actually reach, so the real webhook path
 * — POST /api/webhooks/github/:projectId — can never be exercised by an
 * automated test the way it was manually verified against a real repo and a
 * real ngrok tunnel. This calls the exact same `processGithubWebhookEvent`
 * the production job queue calls after signature verification passes, so the
 * business logic under test is identical; only the transport is swapped out.
 * See e2e/tests/github/github-webhook-processing.spec.ts and the fixtures
 * under e2e/fixtures/github-webhook-payloads/, captured from real deliveries.
 *
 * The route this is bound to is only mounted when NODE_ENV !== 'production'
 * (see index.ts) — the check here is belt-and-suspenders in case that ever
 * changes, on top of requireAuth + requireProjectRole(['project_admin']).
 */
export const runGithubWebhookEventForTest = async (req: Request, res: Response): Promise<void> => {
  if (env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  const projectId = req.params.projectId as string;
  const { event, payload, defaultBranch } = req.body ?? {};

  if (typeof event !== 'string' || !payload || typeof payload !== 'object') {
    res.status(400).json({ error: 'event (string) and payload (object) are required.' });
    return;
  }

  try {
    await processGithubWebhookEvent(projectId, event, payload, defaultBranch ?? null);
    res.status(200).json({ message: 'Processed.' });
  } catch (err) {
    console.error('Test webhook event processing error:', err);
    res.status(500).json({ error: 'Failed to process test webhook event.' });
  }
};
