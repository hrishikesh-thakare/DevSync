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
  createGithubIssue,
  getGithubIssues,
  addIssueComment,
  createGithubPullRequest,
  getGithubPullRequests,
  createGithubBranch,
  getGithubBranches,
  retriggerWorkflow,
  getTaskGithubActivity,
} from './github.controller.js';
import express from 'express';

// ─── Project-level routes for configuration ──────────────────────────────────
// Mounted at: /api/workspaces/:slug/projects/:key/github
export const githubConfigRouter = Router({ mergeParams: true });

githubConfigRouter.use(requireAuth);
githubConfigRouter.use(requireWorkspaceRole(['owner', 'admin', 'member']));
githubConfigRouter.get('/connection', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubConnection);
githubConfigRouter.post('/connect', requireProjectRole(['project_admin']), connectGithubRepo);
githubConfigRouter.delete('/disconnect', requireProjectRole(['project_admin']), disconnectGithubRepo);
githubConfigRouter.get('/commits', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubCommits);
githubConfigRouter.get('/ci', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubCiRuns);

// ─── NEW: Issues, Pull Requests, Branches, CI Re-run ────────────────────────
githubConfigRouter.post('/issues', requireProjectRole(['project_admin', 'developer']), createGithubIssue);
githubConfigRouter.get('/issues', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubIssues);
githubConfigRouter.post('/issues/:issueNumber/comments', requireProjectRole(['project_admin', 'developer']), addIssueComment);
githubConfigRouter.post('/pull-requests', requireProjectRole(['project_admin', 'developer']), createGithubPullRequest);
githubConfigRouter.get('/pull-requests', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubPullRequests);
githubConfigRouter.post('/branches', requireProjectRole(['project_admin', 'developer']), createGithubBranch);
githubConfigRouter.get('/branches', requireProjectRole(['project_admin', 'developer', 'viewer']), getGithubBranches);
githubConfigRouter.post('/ci/:runId/rerun', requireProjectRole(['project_admin', 'developer']), retriggerWorkflow);

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
export const githubUserRouter = Router();
githubUserRouter.use(requireAuth);
githubUserRouter.get('/oauth/url', getGithubOauthUrl);
githubUserRouter.post('/oauth/exchange', exchangeGithubCode);
githubUserRouter.get('/user/repos', getUserGithubRepos);

