import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireProjectRole, requireWorkspaceRole } from '../../middleware/roles.js';
import {
  connectGithubRepo,
  disconnectGithubRepo,
  getGithubConnection,
  getGithubCommits,
  getGithubCiRuns,
  getTaskCommits,
  handleGithubWebhook,
  getGithubIssues,
  addIssueComment,
  addPrComment,
  createGithubPullRequest,
  getGithubPullRequests,
  createGithubBranch,
  getGithubBranches,
  retriggerWorkflow,
  getTaskGithubActivity,
  getIssueComments,
  getWorkflowRunLogs,
} from './github.controller.js';
import express from 'express';
import { validate, numericParam } from '../../middleware/validate.js';
import {
  connectGithubSchema,
  addGithubCommentSchema,
  createPullRequestSchema,
  createBranchSchema,
} from './github.schemas.js';

// ─── Project-level routes for configuration ──────────────────────────────────
// Mounted at: /api/workspaces/:slug/projects/:key/github
export const githubConfigRouter = Router({ mergeParams: true });

githubConfigRouter.use(requireAuth);
githubConfigRouter.use(requireWorkspaceRole(['owner', 'admin', 'member']));

// Every numeric GitHub id below is interpolated into an api.github.com URL —
// see `numericParam` for why that has to be validated before it gets there.
githubConfigRouter.param('runId', numericParam('runId'));
githubConfigRouter.param('issueNumber', numericParam('issueNumber'));
githubConfigRouter.param('prNumber', numericParam('prNumber'));
githubConfigRouter.get('/connection', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubConnection);
githubConfigRouter.post('/connect', requireProjectRole(['project_admin']), validate(connectGithubSchema), connectGithubRepo);
githubConfigRouter.delete('/disconnect', requireProjectRole(['project_admin']), disconnectGithubRepo);
githubConfigRouter.get('/commits', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubCommits);
githubConfigRouter.get('/ci', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubCiRuns);

// ─── NEW: Issues, Pull Requests, Branches, CI Re-run ────────────────────────

githubConfigRouter.get('/issues', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubIssues);
githubConfigRouter.post('/issues/:issueNumber/comments', requireProjectRole(['project_admin', 'developer']), validate(addGithubCommentSchema), addIssueComment);
githubConfigRouter.get('/issues/:issueNumber/comments', requireProjectRole(['project_admin', 'developer', 'viewer']), getIssueComments);
githubConfigRouter.post('/pull-requests', requireProjectRole(['project_admin', 'developer']), validate(createPullRequestSchema), createGithubPullRequest);
githubConfigRouter.get('/pull-requests', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubPullRequests);
githubConfigRouter.post('/pull-requests/:prNumber/comments', requireProjectRole(['project_admin', 'developer']), validate(addGithubCommentSchema), addPrComment);
githubConfigRouter.get('/pull-requests/:prNumber/comments', requireProjectRole(['project_admin', 'developer', 'viewer']), getIssueComments);
githubConfigRouter.post('/branches', requireProjectRole(['project_admin', 'developer']), validate(createBranchSchema), createGithubBranch);
githubConfigRouter.get('/branches', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubBranches);
githubConfigRouter.post('/ci/:runId/rerun', requireProjectRole(['project_admin', 'developer']), retriggerWorkflow);
githubConfigRouter.get('/ci/:runId/logs', requireProjectRole(['project_admin', 'developer', 'viewer']), getWorkflowRunLogs);

// ─── Webhook routes for GitHub payloads ──────────────────────────────────────
// Mounted at: /api/webhooks/github
export const githubWebhookRouter = Router({ mergeParams: true });

// We need raw body for HMAC signature verification
githubWebhookRouter.post('/:projectId', express.raw({ type: 'application/json' }), handleGithubWebhook);

// ─── Task-level routes ───────────────────────────────────────────────────────
export const githubTaskRouter = Router({ mergeParams: true });
githubTaskRouter.use(requireAuth);
githubTaskRouter.get('/commits', requireProjectRole(['project_admin', 'developer', 'viewer']), getTaskCommits);
githubTaskRouter.get('/github-activity', requireProjectRole(['project_admin', 'developer', 'viewer']), getTaskGithubActivity);

// ─── User-level OAuth routes ────────────────────────────────────────────────
import { exchangeGithubCode, getUserGithubRepos, getGithubOauthUrl } from './github.oauth.controller.js';
import { exchangeGithubCodeSchema } from './github.schemas.js';
export const githubUserRouter = Router();
githubUserRouter.use(requireAuth);
githubUserRouter.get('/oauth/url', getGithubOauthUrl);
githubUserRouter.post('/oauth/exchange', validate(exchangeGithubCodeSchema), exchangeGithubCode);
githubUserRouter.get('/user/repos', getUserGithubRepos);

