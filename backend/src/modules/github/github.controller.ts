import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { githubConnections, githubCommits, githubCiStatus, githubIssues, githubPullRequests, githubBranches } from '../../db/schema/github.js';
import { tasks } from '../../db/schema/tasks.js';
import { projects, projectMembers } from '../../db/schema/projects.js';
import { users } from '../../db/schema/auth.js';
import { eq, and, sql, inArray, or, desc, isNull, isNotNull, count } from 'drizzle-orm';
import { logAuditAction } from '../audit/audit.controller.js';
import { createNotification } from '../notifications/notifications.controller.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { enqueueJob } from '../../workers/queue.js';

// ─── HELPER: Verify GitHub Webhook Signature ─────────────────────────────────
function verifyGitHubSignature(rawBody: Buffer, signatureHeader: string | undefined, webhookSecret: string): boolean {
  if (!signatureHeader) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// ─── HELPER: GitHub API fetch ────────────────────────────────────────────────
async function githubApiFetch(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  }) as unknown as Response;
}

// ─── CONNECT PROJECT TO GITHUB ───────────────────────────────────────────────
// POST /api/workspaces/:slug/projects/:key/github/connect
export const connectGithubRepo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const { repo_owner, repo_name } = req.body;

    if (!repo_owner || !repo_name) {
      res.status(400).json({ error: 'repo_owner and repo_name are required.' });
      return;
    }

    // Fetch the user's connected GitHub access token
    const [user] = await db
      .select({ githubAccessToken: users.githubAccessToken })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user || !user.githubAccessToken) {
      res.status(403).json({ error: 'GitHub account is not connected.' });
      return;
    }

    const access_token = decrypt(user.githubAccessToken);

    // Check if already connected
    const [existing] = await db
      .select({ connectionId: githubConnections.connectionId })
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: 'Project is already connected to a GitHub repository.' });
      return;
    }

    // Step 1: Verify the repo exists via GitHub API
    const repoResponse = await fetch(`https://api.github.com/repos/${repo_owner}/${repo_name}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${access_token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (repoResponse.status === 404) {
      res.status(404).json({ error: 'Repository not found or token has no access.' });
      return;
    }
    if (repoResponse.status === 401) {
      res.status(401).json({ error: 'Invalid GitHub token.' });
      return;
    }
    if (!repoResponse.ok) {
      const errBody = await repoResponse.text();
      console.error('GitHub API error verifying repo:', repoResponse.status, errBody);
      res.status(502).json({ error: 'Failed to verify repository on GitHub.' });
      return;
    }

    const repoData = await repoResponse.json() as Record<string, any>;
    const repoFullName = repoData.full_name as string;    // "octocat/my-repo"
    const repoId = repoData.id as number;
    const defaultBranch = (repoData.default_branch as string) || 'main';

    // Step 2: Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    // Step 3: Create webhook on GitHub
    const webhookUrl = `${env.BACKEND_URL}/api/webhooks/github/${projectId}`;

    const hookResponse = await fetch(`https://api.github.com/repos/${repo_owner}/${repo_name}/hooks`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${access_token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push', 'workflow_run', 'pull_request', 'issues', 'create', 'delete'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: webhookSecret,
        },
      }),
    });

    if (!hookResponse.ok) {
      const hookErr = await hookResponse.text();
      console.error('GitHub API error creating webhook:', hookResponse.status, hookErr);
      res.status(502).json({ error: 'Failed to create webhook on GitHub. Ensure the token has admin:repo_hook scope.' });
      return;
    }

    const hookData = await hookResponse.json() as Record<string, any>;
    const webhookId = hookData.id as number;

    // Step 4: Save connection with encrypted secrets
    const result = await db.transaction(async (tx) => {
      const [connection] = await tx
        .insert(githubConnections)
        .values({
          projectId,
          connectedBy: userId,
          githubRepoFullName: repoFullName,
          githubRepoId: repoId,
          defaultBranch,
          githubAccessToken: encrypt(access_token),
          webhookId,
          webhookSecret: encrypt(webhookSecret),
        })
        .returning();

      const [project] = await tx
        .select({ workspaceId: projects.workspaceId })
        .from(projects)
        .where(eq(projects.projectId, projectId))
        .limit(1);

      await logAuditAction({
        actorId: userId,
        action: 'github.repo_linked',
        entityType: 'project',
        entityId: projectId,
        workspaceId: project?.workspaceId ?? undefined,
        newValues: { repo_full_name: repoFullName, webhook_url: webhookUrl },
        tx,
      });

      return connection;
    });

    res.status(201).json({
      message: 'GitHub repository connected successfully.',
      connection: {
        connectionId: result.connectionId,
        githubRepoFullName: result.githubRepoFullName,
        defaultBranch: result.defaultBranch,
        webhookStatus: 'active',
      },
    });
  } catch (err) {
    console.error('Connect GitHub error:', err);
    res.status(500).json({ error: 'Server error connecting GitHub repo.' });
  }
};

// ─── DISCONNECT GITHUB REPO ─────────────────────────────────────────────────
// DELETE /api/workspaces/:slug/projects/:key/github/disconnect
export const disconnectGithubRepo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;

    // Fetch the connection
    const [connection] = await db
      .select()
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection) {
      res.status(404).json({ error: 'No GitHub connection found for this project.' });
      return;
    }

    // Step 1: Delete webhook from GitHub
    if (connection.githubAccessToken && connection.webhookId && connection.githubRepoFullName) {
      try {
        const token = decrypt(connection.githubAccessToken);
        const deleteRes = await fetch(
          `https://api.github.com/repos/${connection.githubRepoFullName}/hooks/${connection.webhookId}`,
          {
            method: 'DELETE',
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${token}`,
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );
        if (!deleteRes.ok && deleteRes.status !== 404) {
          console.warn('Failed to delete webhook from GitHub:', deleteRes.status, await deleteRes.text());
        }
      } catch (webhookErr) {
        // Token may be revoked or repo deleted — log but continue
        console.warn('Could not delete webhook from GitHub (token may be revoked):', webhookErr);
      }
    }

    // Step 2: Delete the connection row (preserve commits and CI data)
    await db.transaction(async (tx) => {
      await tx
        .delete(githubConnections)
        .where(eq(githubConnections.projectId, projectId));

      const [project] = await tx
        .select({ workspaceId: projects.workspaceId })
        .from(projects)
        .where(eq(projects.projectId, projectId))
        .limit(1);

      await logAuditAction({
        actorId: req.user!.userId,
        action: 'github.repo_unlinked',
        entityType: 'project',
        entityId: projectId,
        workspaceId: project?.workspaceId ?? undefined,
        oldValues: { repo_full_name: connection.githubRepoFullName },
        newValues: null,
        tx,
      });
    });

    res.json({ message: 'GitHub repository disconnected. Existing commit and CI data has been preserved.' });
  } catch (err) {
    console.error('Disconnect GitHub error:', err);
    res.status(500).json({ error: 'Server error disconnecting GitHub repo.' });
  }
};

// ─── GET CONNECTION STATUS ──────────────────────────────────────────────────
// GET /api/workspaces/:slug/projects/:key/github/connection
export const getGithubConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;

    const [connection] = await db
      .select({
        connectionId: githubConnections.connectionId,
        githubRepoFullName: githubConnections.githubRepoFullName,
        defaultBranch: githubConnections.defaultBranch,
        webhookId: githubConnections.webhookId,
        createdAt: githubConnections.createdAt,
        connectedByName: users.fullName,
        connectedByAvatar: users.avatarUrl,
      })
      .from(githubConnections)
      .leftJoin(users, eq(githubConnections.connectedBy, users.userId))
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection) {
      res.json({ connection: null });
      return;
    }

    res.json({
      connection: {
        ...connection,
        webhookStatus: connection.webhookId ? 'active' : 'inactive',
      },
    });
  } catch (err) {
    console.error('Get GitHub connection error:', err);
    res.status(500).json({ error: 'Server error fetching GitHub connection.' });
  }
};

// ─── GITHUB WEBHOOK HANDLER ──────────────────────────────────────────────────
// POST /api/webhooks/github/:projectId
export const handleGithubWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = req.params.projectId as string;
    const event = req.headers['x-github-event'] as string;
    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    // Handle ping event first — no signature verification needed for sanity
    if (event === 'ping') {
      res.status(200).send('pong');
      return;
    }

    // Fetch the connection for this project
    const [connection] = await db
      .select({
        projectId: githubConnections.projectId,
        webhookSecret: githubConnections.webhookSecret,
        defaultBranch: githubConnections.defaultBranch,
      })
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection || !connection.webhookSecret) {
      res.status(404).send('Project not found or no webhook configured.');
      return;
    }

    // Verify HMAC signature using the raw body buffer
    const rawBody = req.body as Buffer;
    const decryptedSecret = decrypt(connection.webhookSecret);

    if (!verifyGitHubSignature(rawBody, signature, decryptedSecret)) {
      res.status(401).send('Invalid signature.');
      return;
    }

    // Parse the payload from raw body
    const payload = JSON.parse(rawBody.toString());

    if (!connection.projectId) {
      res.status(400).send('Connection has no project.');
      return;
    }

    // Enqueue the event for background processing — returns immediately so
    // heavy payloads never block the webhook response. GitHub retries
    // non-2xx deliveries itself; the queue also retries with backoff.
    enqueueJob(
      'github.webhook_event',
      {
        projectId: connection.projectId,
        event,
        payload,
        defaultBranch: connection.defaultBranch,
      },
      { maxAttempts: 3, backoffMs: 5000 }
    );

    res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Server error processing webhook.');
  }
};

/**
 * Runs a verified GitHub webhook event in the background (invoked by the
 * worker queue). Kept here because the event handlers share the module's
 * private helpers.
 */
export const processGithubWebhookEvent = async (
  projectId: string,
  event: string,
  payload: any,
  defaultBranch: string | null
): Promise<void> => {
  // Route to correct handler
  if (event === 'push') {
    await handlePushEvent(projectId, payload);
  } else if (event === 'workflow_run') {
    await handleWorkflowRunEvent(projectId, payload);
  } else if (event === 'pull_request') {
    await handlePullRequestEvent(projectId, payload, defaultBranch);
  } else if (event === 'issues') {
    await handleIssuesEvent(projectId, payload);
  } else if (event === 'create' || event === 'delete') {
    await handleBranchEvent(projectId, payload, event);
  }
};

// ─── PUSH EVENT HANDLER ──────────────────────────────────────────────────────
const handlePushEvent = async (projectId: string, payload: any) => {
  const commits = payload.commits || [];
  const branchName = payload.ref ? payload.ref.replace('refs/heads/', '') : null;
  const repoFullName = payload.repository?.full_name || '';

  for (const commit of commits) {
    // Check if we already processed this commit (duplicate delivery)
    const [existingCommit] = await db
      .select({ id: githubCommits.id })
      .from(githubCommits)
      .where(
        and(
          eq(githubCommits.repoFullName, repoFullName),
          eq(githubCommits.commitSha, commit.id)
        )
      )
      .limit(1);

    if (existingCommit) continue;

    const message = commit.message || '';
    const headline = message.split('\n')[0].substring(0, 200);
    const authorName = commit.author?.name || null;
    const authorUsername = commit.author?.username || null;
    const committedAt = new Date(commit.timestamp);
    const url = commit.url || null;

    // Attempt to match author by GitHub login or email
    let authorUserId: string | null = null;
    const authorEmail = commit.author?.email;

    if (authorEmail || authorUsername) {
      const conditions = [];
      if (authorEmail) conditions.push(eq(users.email, authorEmail.toLowerCase()));
      if (authorUsername) conditions.push(eq(users.githubLogin, authorUsername));

      const [user] = await db
        .select({ userId: users.userId })
        .from(users)
        .where(or(...conditions))
        .limit(1);

      if (user) authorUserId = user.userId;
    }

    // Parse ALL task keys from commit message using the universal regex
    const upperMessage = message.toUpperCase();
    const taskKeyRegex = /\b([A-Z]{1,10}-\d+)\b/g;
    const matches = [...upperMessage.matchAll(taskKeyRegex)];
    let taskKeys = [...new Set(matches.map(m => m[1]))]; // deduplicate

    // Also match task key from branch name
    if (branchName) {
      const branchTaskKeyMatch = branchName.toUpperCase().match(/\b([A-Z]{1,10}-\d+)\b/);
      if (branchTaskKeyMatch) {
        taskKeys.push(branchTaskKeyMatch[1]);
        taskKeys = [...new Set(taskKeys)];
      }
    }

    if (taskKeys.length > 0) {
      // Link commit to ALL matched tasks
      for (const taskKey of taskKeys) {
        const [task] = await db
          .select({ taskId: tasks.taskId, taskKey: tasks.taskKey, status: tasks.status, assigneeId: tasks.assigneeId, reporterId: tasks.reporterId })
          .from(tasks)
          .where(
            and(
              eq(tasks.projectId, projectId),
              eq(tasks.taskKey, taskKey),
              isNull(tasks.deletedAt)
            )
          )
          .limit(1);

        if (!task) continue;

        // Insert commit row linked to this task
        await db.insert(githubCommits).values({
          projectId,
          taskId: task.taskId,
          commitSha: commit.id,
          repoFullName,
          message,
          messageHeadline: headline,
          authorName,
          authorGithubLogin: authorUsername,
          authorUserId,
          committedAt,
          branchName,
          url,
        }).onConflictDoNothing(); // safety: unique constraint on (repo_full_name, commit_sha) per schema

        // Increment linked_commits_count on the task
        await db
          .update(tasks)
          .set({ linkedCommitsCount: sql`linked_commits_count + 1` })
          .where(eq(tasks.taskId, task.taskId));

        // Notifications for task assignee and reporter
        const notifyUser = async (recipientId: string | null) => {
          if (recipientId && recipientId !== authorUserId) {
            await createNotification({
              recipientId,
              actorId: authorUserId || undefined,
              type: 'commit_linked',
              entityType: 'task',
              entityId: task.taskId,
              title: `New commit linked to ${task.taskKey}`,
              body: `${authorName || 'Someone'} pushed "${headline}" on ${branchName || 'a branch'}`,
            });
          }
        };

        await notifyUser(task.assigneeId);
        if (task.reporterId !== task.assigneeId) {
          await notifyUser(task.reporterId);
        }

        // Audit log
        await logAuditAction({
          actorId: authorUserId,
          action: 'github.commit_received',
          entityType: 'task',
          entityId: task.taskId,
          newValues: { commit_sha: commit.id.substring(0, 7), task_key: task.taskKey, branch: branchName },
        });

        // ─── Smart Commit Status Update ────────────────────────────────
        // If commit message contains "fixes DEV-101", "closes DEV-101", "resolves DEV-101"
        // automatically move the task to 'done'
        const closeRegex = new RegExp(`(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\\s+${taskKey}`, 'i');
        if (closeRegex.test(message)) {
          await db
            .update(tasks)
            .set({ status: 'done', updatedAt: new Date() })
            .where(eq(tasks.taskId, task.taskId));

          await logAuditAction({
            actorId: authorUserId,
            action: 'task.auto_closed_by_commit',
            entityType: 'task',
            entityId: task.taskId,
            newValues: { status: 'done', commit_sha: commit.id.substring(0, 7) },
          });
        } else if (task.status === 'todo') {
          // If a branch is pushed with the task ID, or a commit is linked to a todo task, move to in_progress
          await db
            .update(tasks)
            .set({ status: 'in_progress', updatedAt: new Date() })
            .where(eq(tasks.taskId, task.taskId));

          await logAuditAction({
            actorId: authorUserId,
            action: 'task.auto_progress_by_commit',
            entityType: 'task',
            entityId: task.taskId,
            newValues: { status: 'in_progress', commit_sha: commit.id.substring(0, 7) },
          });
        }
      }
    } else {
      // No task key found — store commit unlinked
      const insertResult = await db.insert(githubCommits).values({
        projectId,
        taskId: null,
        commitSha: commit.id,
        repoFullName,
        message,
        messageHeadline: headline,
        authorName,
        authorGithubLogin: authorUsername,
        authorUserId,
        committedAt,
        branchName,
        url,
      }).onConflictDoNothing().returning({ id: githubCommits.id });

      if (insertResult.length > 0) {
        // Find project members to notify
        const members = await db
          .select({ userId: projectMembers.userId })
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, projectId),
              inArray(projectMembers.role, ['project_admin', 'developer'])
            )
          );

        const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.projectId, projectId));

        for (const member of members) {
          if (member.userId !== authorUserId) {
            await createNotification({
              recipientId: member.userId as string,
              actorId: authorUserId || undefined,
              type: 'commit_unlinked',
              entityType: 'project',
              entityId: projectId,
              title: `New commit in ${project?.name || 'Project'}`,
              body: `${authorName || 'Someone'} pushed "${headline}" on ${branchName || 'a branch'}`,
            });
          }
        }
      }
    }
  }
};

// ─── WORKFLOW RUN EVENT HANDLER ──────────────────────────────────────────────
const handleWorkflowRunEvent = async (projectId: string, payload: any) => {
  const workflowRun = payload.workflow_run;
  if (!workflowRun) return;

  const runId = workflowRun.id;

  const [existing] = await db
    .select({ id: githubCiStatus.id, status: githubCiStatus.status, conclusion: githubCiStatus.conclusion })
    .from(githubCiStatus)
    .where(and(eq(githubCiStatus.projectId, projectId), eq(githubCiStatus.runId, runId)))
    .limit(1);

  if (existing) {
    await db
      .update(githubCiStatus)
      .set({
        status: workflowRun.status,
        conclusion: workflowRun.conclusion,
        completedAt: workflowRun.updated_at ? new Date(workflowRun.updated_at) : null,
      })
      .where(eq(githubCiStatus.id, existing.id));
  } else {
    await db.insert(githubCiStatus).values({
      projectId,
      workflowName: workflowRun.name,
      runId,
      status: workflowRun.status,
      conclusion: workflowRun.conclusion,
      headBranch: workflowRun.head_branch,
      headSha: workflowRun.head_sha,
      htmlUrl: workflowRun.html_url,
      triggeredAt: new Date(workflowRun.created_at || workflowRun.run_started_at),
      completedAt: workflowRun.updated_at ? new Date(workflowRun.updated_at) : null,
    });
  }

  // Fire CI status notification
  if (workflowRun.status === 'completed' && (workflowRun.conclusion === 'failure' || workflowRun.conclusion === 'success')) {
    let shouldNotify = false;
    if (!existing) {
      shouldNotify = true;
    } else if (existing.status !== 'completed' || existing.conclusion !== workflowRun.conclusion) {
      shouldNotify = true;
    }

    if (shouldNotify) {
      const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.projectId, projectId));
      const members = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            inArray(projectMembers.role, ['project_admin', 'developer'])
          )
        );

      const type = workflowRun.conclusion === 'success' ? 'ci_passed' : 'ci_failed';
      const title = workflowRun.conclusion === 'success' 
        ? `CI passed in ${project?.name || 'Project'}` 
        : `CI failed in ${project?.name || 'Project'}`;

      for (const member of members) {
        await createNotification({
          recipientId: member.userId as string,
          type,
          entityType: 'project',
          entityId: projectId,
          title,
          body: `Workflow '${workflowRun.name}' ${workflowRun.conclusion} on ${workflowRun.head_branch} (commit ${workflowRun.head_sha?.substring(0, 7)})`,
        });
      }

      await logAuditAction({
        actorId: null,
        action: 'github.ci_status_received',
        entityType: 'project',
        entityId: projectId,
        newValues: {
          workflow_name: workflowRun.name,
          conclusion: workflowRun.conclusion,
          head_branch: workflowRun.head_branch,
          run_id: workflowRun.id,
        },
      });
    }
  }
};

// ─── GET COMMITS FOR PROJECT ─────────────────────────────────────────────────
// GET /api/workspaces/:slug/projects/:key/github/commits
export const getGithubCommits = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 25), 100);
    const offset = (page - 1) * limit;
    const branch = req.query.branch as string | undefined;
    const linked = req.query.linked as string | undefined; // 'true' | 'false' | 'all'

    // Build conditions
    const conditions = [eq(githubCommits.projectId, projectId)];
    if (branch && branch !== 'all') {
      conditions.push(eq(githubCommits.branchName, branch));
    }
    if (linked === 'true') {
      conditions.push(isNotNull(githubCommits.taskId));
    } else if (linked === 'false') {
      conditions.push(isNull(githubCommits.taskId));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ value: totalCount }] = await db
      .select({ value: count() })
      .from(githubCommits)
      .where(whereClause);

    // Get paginated commits with joins
    const commitRows = await db
      .select({
        id: githubCommits.id,
        commitSha: githubCommits.commitSha,
        messageHeadline: githubCommits.messageHeadline,
        authorName: githubCommits.authorName,
        authorGithubLogin: githubCommits.authorGithubLogin,
        authorUserId: githubCommits.authorUserId,
        authorAvatar: users.avatarUrl,
        committedAt: githubCommits.committedAt,
        branchName: githubCommits.branchName,
        url: githubCommits.url,
        taskId: githubCommits.taskId,
        taskKey: tasks.taskKey,
      })
      .from(githubCommits)
      .leftJoin(tasks, eq(githubCommits.taskId, tasks.taskId))
      .leftJoin(users, eq(githubCommits.authorUserId, users.userId))
      .where(whereClause)
      .orderBy(desc(githubCommits.committedAt))
      .limit(limit)
      .offset(offset);

    // Get distinct branches for filter dropdown
    const branchRows = await db
      .selectDistinct({ branchName: githubCommits.branchName })
      .from(githubCommits)
      .where(and(eq(githubCommits.projectId, projectId), isNotNull(githubCommits.branchName)));

    const branches = branchRows.map(r => r.branchName).filter(Boolean) as string[];

    res.json({
      commits: commitRows,
      totalCount: Number(totalCount),
      page,
      totalPages: Math.ceil(Number(totalCount) / limit),
      branches,
    });
  } catch (err) {
    console.error('Get GitHub commits error:', err);
    res.status(500).json({ error: 'Server error fetching commits.' });
  }
};

// ─── GET CI RUNS FOR PROJECT ─────────────────────────────────────────────────
// GET /api/workspaces/:slug/projects/:key/github/ci
export const getGithubCiRuns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 25), 100);
    const offset = (page - 1) * limit;
    const branch = req.query.branch as string | undefined;
    const conclusion = req.query.conclusion as string | undefined;

    // Build conditions
    const conditions = [eq(githubCiStatus.projectId, projectId)];
    if (branch && branch !== 'all') {
      conditions.push(eq(githubCiStatus.headBranch, branch));
    }
    if (conclusion && conclusion !== 'all') {
      conditions.push(eq(githubCiStatus.conclusion, conclusion));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ value: totalCount }] = await db
      .select({ value: count() })
      .from(githubCiStatus)
      .where(whereClause);

    // Get paginated runs
    const runRows = await db
      .select()
      .from(githubCiStatus)
      .where(whereClause)
      .orderBy(desc(githubCiStatus.triggeredAt))
      .limit(limit)
      .offset(offset);

    // Get distinct branches for filter dropdown
    const branchRows = await db
      .selectDistinct({ headBranch: githubCiStatus.headBranch })
      .from(githubCiStatus)
      .where(and(eq(githubCiStatus.projectId, projectId), isNotNull(githubCiStatus.headBranch)));

    const branches = branchRows.map(r => r.headBranch).filter(Boolean) as string[];

    res.json({
      runs: runRows,
      totalCount: Number(totalCount),
      page,
      totalPages: Math.ceil(Number(totalCount) / limit),
      branches,
    });
  } catch (err) {
    console.error('Get GitHub CI runs error:', err);
    res.status(500).json({ error: 'Server error fetching CI runs.' });
  }
};

// ─── GET COMMITS FOR A SPECIFIC TASK ─────────────────────────────────────────
// GET /api/workspaces/:slug/projects/:key/tasks/:taskKey/commits
export const getTaskCommits = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = (req.params.taskId || res.locals.taskId) as string;

    if (!taskId) {
      res.status(400).json({ error: 'Task ID is required.' });
      return;
    }

    const commitRows = await db
      .select({
        id: githubCommits.id,
        commitSha: githubCommits.commitSha,
        messageHeadline: githubCommits.messageHeadline,
        authorName: githubCommits.authorName,
        authorGithubLogin: githubCommits.authorGithubLogin,
        committedAt: githubCommits.committedAt,
        branchName: githubCommits.branchName,
        url: githubCommits.url,
      })
      .from(githubCommits)
      .where(eq(githubCommits.taskId, taskId))
      .orderBy(desc(githubCommits.committedAt));

    res.json({ commits: commitRows });
  } catch (err) {
    console.error('Get task commits error:', err);
    res.status(500).json({ error: 'Server error fetching task commits.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Helper — Match task key from text
// ═══════════════════════════════════════════════════════════════════════════
const matchTaskKeyFromText = (text: string): string | null => {
  if (!text) return null;
  const upper = text.toUpperCase();
  const match = upper.match(/\b([A-Z]{1,10}-\d+)\b/);
  return match ? match[1] : null;
};

const findTaskByKey = async (projectId: string, taskKey: string) => {
  const [task] = await db
    .select({ taskId: tasks.taskId, taskKey: tasks.taskKey, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.taskKey, taskKey), isNull(tasks.deletedAt)))
    .limit(1);
  return task || null;
};

const matchAuthorUserId = async (login: string | null): Promise<string | null> => {
  if (!login) return null;
  const [user] = await db
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.githubLogin, login))
    .limit(1);
  return user?.userId || null;
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Webhook — Pull Request Event Handler
// ═══════════════════════════════════════════════════════════════════════════
const handlePullRequestEvent = async (projectId: string, payload: any, defaultBranch: string | null) => {
  const pr = payload.pull_request;
  if (!pr) return;

  const action = payload.action; // opened, closed, reopened, edited, synchronize
  const prNumber = pr.number;
  const prTitle = pr.title || '';
  const prBody = pr.body || '';
  const headBranch = pr.head?.ref || '';
  const baseBranch = pr.base?.ref || '';
  const authorLogin = pr.user?.login || null;
  const htmlUrl = pr.html_url || null;

  // Determine state
  let state = pr.state; // 'open' or 'closed'
  if (pr.merged || pr.merged_at) state = 'merged';

  // Match task key from PR title, body, or head branch
  const taskKey = matchTaskKeyFromText(prTitle) || matchTaskKeyFromText(prBody) || matchTaskKeyFromText(headBranch);
  let taskId: string | null = null;
  if (taskKey) {
    const task = await findTaskByKey(projectId, taskKey);
    if (task) taskId = task.taskId;
  }

  const authorUserId = await matchAuthorUserId(authorLogin);

  // Upsert
  const [existing] = await db
    .select({ id: githubPullRequests.id })
    .from(githubPullRequests)
    .where(and(eq(githubPullRequests.projectId, projectId), eq(githubPullRequests.prNumber, prNumber)))
    .limit(1);

  if (existing) {
    await db.update(githubPullRequests).set({
      title: prTitle.substring(0, 500),
      body: prBody,
      state,
      headBranch,
      baseBranch,
      htmlUrl,
      authorGithubLogin: authorLogin,
      authorUserId,
      taskId,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
      updatedAt: new Date(),
    }).where(eq(githubPullRequests.id, existing.id));
  } else {
    await db.insert(githubPullRequests).values({
      projectId,
      taskId,
      prNumber,
      githubPrId: pr.id,
      title: prTitle.substring(0, 500),
      body: prBody,
      state,
      htmlUrl,
      headBranch,
      baseBranch,
      authorGithubLogin: authorLogin,
      authorUserId,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
    }).onConflictDoNothing();
  }

  // If PR is merged and linked to a task, auto-move task to "done"
  // ONLY IF the target branch (baseBranch) is the default branch
  const isDefaultBranch = defaultBranch ? baseBranch === defaultBranch : (baseBranch === 'main' || baseBranch === 'master');

  if (state === 'merged' && taskId && isDefaultBranch) {
    await db.update(tasks).set({ status: 'done', updatedAt: new Date() }).where(eq(tasks.taskId, taskId));
    await logAuditAction({
      actorId: authorUserId,
      action: 'task.auto_closed_by_pr_merge',
      entityType: 'task',
      entityId: taskId,
      newValues: { status: 'done', pr_number: prNumber },
    });
  } else if ((action === 'opened' || action === 'reopened') && taskId) {
    // If PR is opened and linked to a task, auto-move task to "in_review"
    const linkedTask = await findTaskByKey(projectId, taskKey!);
    if (linkedTask && (linkedTask.status === 'todo' || linkedTask.status === 'in_progress')) {
      await db.update(tasks).set({ status: 'in_review', updatedAt: new Date() }).where(eq(tasks.taskId, taskId));
      await logAuditAction({
        actorId: authorUserId,
        action: 'task.auto_review_by_pr_open',
        entityType: 'task',
        entityId: taskId,
        newValues: { status: 'in_review', pr_number: prNumber },
      });
    }
  }

  // Notifications
  if (action === 'opened' || state === 'merged') {
    const [project] = await db.select({ name: projects.name }).from(projects).where(eq(projects.projectId, projectId));
    const members = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), inArray(projectMembers.role, ['project_admin', 'developer'])));

    const type = state === 'merged' ? 'pr_merged' : 'pr_opened';
    const title = state === 'merged'
      ? `PR #${prNumber} merged in ${project?.name || 'Project'}`
      : `PR #${prNumber} opened in ${project?.name || 'Project'}`;

    for (const member of members) {
      if (member.userId !== authorUserId) {
        await createNotification({
          recipientId: member.userId as string,
          actorId: authorUserId || undefined,
          type,
          entityType: 'project',
          entityId: projectId,
          title,
          body: `"${prTitle.substring(0, 100)}" by ${authorLogin || 'someone'} (${headBranch} → ${baseBranch})`,
        });
      }
    }
  }

  await logAuditAction({
    actorId: authorUserId,
    action: `github.pr_${action}`,
    entityType: 'project',
    entityId: projectId,
    newValues: { pr_number: prNumber, state, head_branch: headBranch },
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Webhook — Issues Event Handler
// ═══════════════════════════════════════════════════════════════════════════
const handleIssuesEvent = async (projectId: string, payload: any) => {
  const issue = payload.issue;
  if (!issue) return;

  const issueNumber = issue.number;
  const issueTitle = issue.title || '';
  const issueBody = issue.body || '';
  const authorLogin = issue.user?.login || null;
  const htmlUrl = issue.html_url || null;
  const state = issue.state; // open|closed
  const labels = (issue.labels || []).map((l: any) => l.name);

  // Match task key
  const taskKey = matchTaskKeyFromText(issueTitle) || matchTaskKeyFromText(issueBody);
  let taskId: string | null = null;
  if (taskKey) {
    const task = await findTaskByKey(projectId, taskKey);
    if (task) taskId = task.taskId;
  }

  const authorUserId = await matchAuthorUserId(authorLogin);

  // Upsert
  const [existing] = await db
    .select({ id: githubIssues.id })
    .from(githubIssues)
    .where(and(eq(githubIssues.projectId, projectId), eq(githubIssues.githubIssueNumber, issueNumber)))
    .limit(1);

  if (existing) {
    await db.update(githubIssues).set({
      title: issueTitle.substring(0, 500),
      body: issueBody,
      state,
      htmlUrl,
      authorGithubLogin: authorLogin,
      authorUserId,
      taskId,
      labels,
      closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
      updatedAt: new Date(),
    }).where(eq(githubIssues.id, existing.id));
  } else {
    await db.insert(githubIssues).values({
      projectId,
      taskId,
      githubIssueNumber: issueNumber,
      githubIssueId: issue.id,
      title: issueTitle.substring(0, 500),
      body: issueBody,
      state,
      htmlUrl,
      authorGithubLogin: authorLogin,
      authorUserId,
      labels,
      closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
    }).onConflictDoNothing();
  }

  await logAuditAction({
    actorId: authorUserId,
    action: `github.issue_${payload.action}`,
    entityType: 'project',
    entityId: projectId,
    newValues: { issue_number: issueNumber, state },
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Webhook — Branch Create / Delete Event Handler
// ═══════════════════════════════════════════════════════════════════════════
const handleBranchEvent = async (projectId: string, payload: any, event: string) => {
  // Only handle branch events (not tags)
  if (payload.ref_type !== 'branch') return;

  const branchName = payload.ref;
  if (!branchName) return;

  const senderLogin = payload.sender?.login || null;
  const senderUserId = await matchAuthorUserId(senderLogin);

  // Try to match task key from branch name
  const taskKey = matchTaskKeyFromText(branchName);
  let taskId: string | null = null;
  if (taskKey) {
    const task = await findTaskByKey(projectId, taskKey);
    if (task) taskId = task.taskId;
  }

  // Get repo info for html_url
  const repoFullName = payload.repository?.full_name || '';
  const htmlUrl = repoFullName ? `https://github.com/${repoFullName}/tree/${branchName}` : null;

  if (event === 'create') {
    await db.insert(githubBranches).values({
      projectId,
      taskId,
      branchName,
      isDeleted: false,
      createdByUserId: senderUserId,
      htmlUrl,
    }).onConflictDoNothing();

    // If linked to a task, update task status to "in_progress"
    if (taskId) {
      const linkedTask = await findTaskByKey(projectId, taskKey!);
      if (linkedTask && linkedTask.status === 'todo') {
        await db.update(tasks).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(tasks.taskId, taskId));
      }
    }
  } else if (event === 'delete') {
    await db.update(githubBranches).set({ isDeleted: true })
      .where(and(eq(githubBranches.projectId, projectId), eq(githubBranches.branchName, branchName)));
  }

  await logAuditAction({
    actorId: senderUserId,
    action: `github.branch_${event}d`,
    entityType: 'project',
    entityId: projectId,
    newValues: { branch: branchName },
  });
};


// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — List GitHub Issues
// ═══════════════════════════════════════════════════════════════════════════
// GET /api/workspaces/:slug/projects/:key/github/issues
export const getGithubIssues = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 25), 100);
    const offset = (page - 1) * limit;
    const state = req.query.state as string | undefined;

    const conditions = [eq(githubIssues.projectId, projectId)];
    if (state && state !== 'all') conditions.push(eq(githubIssues.state, state));

    const whereClause = and(...conditions);

    const [{ value: totalCount }] = await db.select({ value: count() }).from(githubIssues).where(whereClause);

    const rows = await db
      .select({
        id: githubIssues.id,
        githubIssueNumber: githubIssues.githubIssueNumber,
        title: githubIssues.title,
        body: githubIssues.body,
        state: githubIssues.state,
        htmlUrl: githubIssues.htmlUrl,
        authorGithubLogin: githubIssues.authorGithubLogin,
        labels: githubIssues.labels,
        taskId: githubIssues.taskId,
        taskKey: tasks.taskKey,
        closedAt: githubIssues.closedAt,
        createdAt: githubIssues.createdAt,
      })
      .from(githubIssues)
      .leftJoin(tasks, eq(githubIssues.taskId, tasks.taskId))
      .where(whereClause)
      .orderBy(desc(githubIssues.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      issues: rows,
      totalCount: Number(totalCount),
      page,
      totalPages: Math.ceil(Number(totalCount) / limit),
    });
  } catch (err) {
    console.error('Get GitHub issues error:', err);
    res.status(500).json({ error: 'Server error fetching issues.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — Add Comment to GitHub Issue
// ═══════════════════════════════════════════════════════════════════════════
// POST /api/workspaces/:slug/projects/:key/github/issues/:issueNumber/comments
export const addIssueComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, issueNumber } = req.params as Record<string, string>;
    const { body } = req.body;

    if (!body) {
      res.status(400).json({ error: 'Comment body is required.' });
      return;
    }

    const [connection] = await db
      .select({ githubRepoFullName: githubConnections.githubRepoFullName, githubAccessToken: githubConnections.githubAccessToken })
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection || !connection.githubAccessToken) {
      res.status(404).json({ error: 'No GitHub connection found.' });
      return;
    }

    const token = decrypt(connection.githubAccessToken);

    const ghRes = await githubApiFetch(
      `https://api.github.com/repos/${connection.githubRepoFullName}/issues/${issueNumber}/comments`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }
    ) as any;

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      console.error('GitHub add comment error:', ghRes.status, errText);
      res.status(502).json({ error: 'Failed to add comment on GitHub.' });
      return;
    }

    const comment = await ghRes.json() as any;
    res.status(201).json({ message: 'Comment posted on GitHub.', comment: { id: comment.id, body: comment.body, html_url: comment.html_url } });
  } catch (err) {
    console.error('Add issue comment error:', err);
    res.status(500).json({ error: 'Server error adding comment.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — Get Comments for GitHub Issue or PR
// ═══════════════════════════════════════════════════════════════════════════
// GET /api/workspaces/:slug/projects/:key/github/issues/:issueNumber/comments
// GET /api/workspaces/:slug/projects/:key/github/pull-requests/:prNumber/comments
export const getIssueComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, issueNumber, prNumber } = req.params as Record<string, string>;
    const number = issueNumber || prNumber;

    const [connection] = await db
      .select({ githubRepoFullName: githubConnections.githubRepoFullName, githubAccessToken: githubConnections.githubAccessToken })
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection || !connection.githubAccessToken) {
      res.status(404).json({ error: 'No GitHub connection found.' });
      return;
    }

    const token = decrypt(connection.githubAccessToken);

    const ghRes = await githubApiFetch(
      `https://api.github.com/repos/${connection.githubRepoFullName}/issues/${number}/comments`,
      token
    ) as any;

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      console.error('GitHub get comments error:', ghRes.status, errText);
      res.status(502).json({ error: 'Failed to fetch comments from GitHub.' });
      return;
    }

    const comments = await ghRes.json() as any[];
    const formattedComments = comments.map(c => ({
      id: c.id,
      body: c.body,
      user: {
        login: c.user.login,
        avatarUrl: c.user.avatar_url,
      },
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      htmlUrl: c.html_url,
    }));

    res.json({ comments: formattedComments });
  } catch (err) {
    console.error('Get issue comments error:', err);
    res.status(500).json({ error: 'Server error fetching comments.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — Add Comment to GitHub Pull Request
// ═══════════════════════════════════════════════════════════════════════════
// POST /api/workspaces/:slug/projects/:key/github/pull-requests/:prNumber/comments
export const addPrComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, prNumber } = req.params as Record<string, string>;
    const { body } = req.body;

    if (!body) {
      res.status(400).json({ error: 'Comment body is required.' });
      return;
    }

    const [connection] = await db
      .select({ githubRepoFullName: githubConnections.githubRepoFullName, githubAccessToken: githubConnections.githubAccessToken })
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection || !connection.githubAccessToken) {
      res.status(404).json({ error: 'No GitHub connection found.' });
      return;
    }

    const token = decrypt(connection.githubAccessToken);

    // GitHub's API treats PRs as issues — same comment endpoint works
    const ghRes = await githubApiFetch(
      `https://api.github.com/repos/${connection.githubRepoFullName}/issues/${prNumber}/comments`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }
    ) as any;

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      console.error('GitHub add PR comment error:', ghRes.status, errText);
      res.status(502).json({ error: 'Failed to add comment on GitHub PR.' });
      return;
    }

    const comment = await ghRes.json() as any;
    res.status(201).json({ message: 'Comment posted on GitHub PR.', comment: { id: comment.id, body: comment.body, html_url: comment.html_url } });
  } catch (err) {
    console.error('Add PR comment error:', err);
    res.status(500).json({ error: 'Server error adding PR comment.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — Create Pull Request
// ═══════════════════════════════════════════════════════════════════════════
// POST /api/workspaces/:slug/projects/:key/github/pull-requests
export const createGithubPullRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const { title, body, head, base, taskId } = req.body;

    if (!title || !head || !base) {
      res.status(400).json({ error: 'title, head (source branch), and base (target branch) are required.' });
      return;
    }

    const [connection] = await db
      .select({ githubRepoFullName: githubConnections.githubRepoFullName, githubAccessToken: githubConnections.githubAccessToken })
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection || !connection.githubAccessToken) {
      res.status(404).json({ error: 'No GitHub connection found.' });
      return;
    }

    const token = decrypt(connection.githubAccessToken);

    const ghRes = await githubApiFetch(
      `https://api.github.com/repos/${connection.githubRepoFullName}/pulls`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: body || '', head, base }),
      }
    ) as any;

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      console.error('GitHub create PR error:', ghRes.status, errText);
      
      let userFriendlyError = 'Failed to create PR on GitHub.';
      if (errText.includes('No commits between')) {
        userFriendlyError = `Branches '${head}' and '${base}' are identical / in sync. Push at least one new commit to '${head}' before creating a Pull Request.`;
      } else if (errText.includes('A pull request already exists')) {
        userFriendlyError = `A Pull Request already exists between '${head}' and '${base}'.`;
      } else {
        try {
          const parsed = JSON.parse(errText);
          userFriendlyError = parsed.message || userFriendlyError;
          if (parsed.errors && parsed.errors[0]?.message) {
            userFriendlyError += ` (${parsed.errors[0].message})`;
          }
        } catch (e) {}
      }

      res.status(400).json({ error: userFriendlyError });
      return;
    }

    const ghPr = await ghRes.json() as any;
    const [user] = await db.select({ githubLogin: users.githubLogin }).from(users).where(eq(users.userId, userId)).limit(1);

    const [saved] = await db.insert(githubPullRequests).values({
      projectId,
      taskId: taskId || null,
      prNumber: ghPr.number,
      githubPrId: ghPr.id,
      title: ghPr.title,
      body: ghPr.body || '',
      state: ghPr.state,
      htmlUrl: ghPr.html_url,
      headBranch: head,
      baseBranch: base,
      authorGithubLogin: user?.githubLogin || null,
      authorUserId: userId,
    }).returning();

    await logAuditAction({
      actorId: userId,
      action: 'github.pr_created',
      entityType: 'project',
      entityId: projectId,
      newValues: { pr_number: ghPr.number, title, head, base },
    });

    res.status(201).json({ message: 'Pull request created on GitHub.', pullRequest: saved });
  } catch (err) {
    console.error('Create GitHub PR error:', err);
    res.status(500).json({ error: 'Server error creating pull request.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — List Pull Requests
// ═══════════════════════════════════════════════════════════════════════════
// GET /api/workspaces/:slug/projects/:key/github/pull-requests
export const getGithubPullRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 25), 100);
    const offset = (page - 1) * limit;
    const state = req.query.state as string | undefined;

    const conditions = [eq(githubPullRequests.projectId, projectId)];
    if (state && state !== 'all') conditions.push(eq(githubPullRequests.state, state));

    const whereClause = and(...conditions);

    const [{ value: totalCount }] = await db.select({ value: count() }).from(githubPullRequests).where(whereClause);

    const rows = await db
      .select({
        id: githubPullRequests.id,
        prNumber: githubPullRequests.prNumber,
        title: githubPullRequests.title,
        state: githubPullRequests.state,
        htmlUrl: githubPullRequests.htmlUrl,
        headBranch: githubPullRequests.headBranch,
        baseBranch: githubPullRequests.baseBranch,
        authorGithubLogin: githubPullRequests.authorGithubLogin,
        taskId: githubPullRequests.taskId,
        taskKey: tasks.taskKey,
        mergedAt: githubPullRequests.mergedAt,
        closedAt: githubPullRequests.closedAt,
        createdAt: githubPullRequests.createdAt,
      })
      .from(githubPullRequests)
      .leftJoin(tasks, eq(githubPullRequests.taskId, tasks.taskId))
      .where(whereClause)
      .orderBy(desc(githubPullRequests.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      pullRequests: rows,
      totalCount: Number(totalCount),
      page,
      totalPages: Math.ceil(Number(totalCount) / limit),
    });
  } catch (err) {
    console.error('Get GitHub PRs error:', err);
    res.status(500).json({ error: 'Server error fetching pull requests.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — Create Branch
// ═══════════════════════════════════════════════════════════════════════════
// POST /api/workspaces/:slug/projects/:key/github/branches
export const createGithubBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const userId = req.user!.userId;
    const { branchName, baseBranch, taskId } = req.body;

    if (!branchName) {
      res.status(400).json({ error: 'Branch name is required.' });
      return;
    }

    const [connection] = await db
      .select({
        githubRepoFullName: githubConnections.githubRepoFullName,
        githubAccessToken: githubConnections.githubAccessToken,
        defaultBranch: githubConnections.defaultBranch,
      })
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection || !connection.githubAccessToken) {
      res.status(404).json({ error: 'No GitHub connection found.' });
      return;
    }

    const token = decrypt(connection.githubAccessToken);
    const base = baseBranch || connection.defaultBranch || 'main';

    // Get the SHA of the base branch
    const refRes = await githubApiFetch(
      `https://api.github.com/repos/${connection.githubRepoFullName}/git/ref/heads/${base}`,
      token,
    ) as any;

    if (!refRes.ok) {
      const errText = await refRes.text();
      console.error('GitHub get ref error:', refRes.status, errText);
      res.status(502).json({ error: `Failed to find base branch '${base}' on GitHub.` });
      return;
    }

    const refData = await refRes.json() as any;
    const sha = refData.object?.sha;

    // Create new branch
    const createRes = await githubApiFetch(
      `https://api.github.com/repos/${connection.githubRepoFullName}/git/refs`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
      }
    ) as any;

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('GitHub create branch error:', createRes.status, errText);
      let userFriendlyError = `Failed to create branch '${branchName}' on GitHub.`;
      if (errText.includes('Reference already exists')) {
        userFriendlyError = `Branch '${branchName}' already exists on GitHub.`;
      }
      res.status(400).json({ error: userFriendlyError });
      return;
    }

    const htmlUrl = `https://github.com/${connection.githubRepoFullName}/tree/${branchName}`;

    // Save locally
    const [saved] = await db.insert(githubBranches).values({
      projectId,
      taskId: taskId || null,
      branchName,
      isDeleted: false,
      createdByUserId: userId,
      htmlUrl,
    }).onConflictDoNothing().returning();

    // If linked to a task in "todo" status, move it to "in_progress"
    if (taskId) {
      const [task] = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.taskId, taskId)).limit(1);
      if (task && task.status === 'todo') {
        await db.update(tasks).set({ status: 'in_progress', updatedAt: new Date() }).where(eq(tasks.taskId, taskId));
      }
    }

    await logAuditAction({
      actorId: userId,
      action: 'github.branch_created',
      entityType: 'project',
      entityId: projectId,
      newValues: { branch: branchName, base },
    });

    res.status(201).json({ message: 'Branch created on GitHub.', branch: saved || { branchName, htmlUrl } });
  } catch (err) {
    console.error('Create GitHub branch error:', err);
    res.status(500).json({ error: 'Server error creating branch.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — List Branches
// ═══════════════════════════════════════════════════════════════════════════
// GET /api/workspaces/:slug/projects/:key/github/branches
export const getGithubBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params as Record<string, string>;

    const rows = await db
      .select({
        id: githubBranches.id,
        branchName: githubBranches.branchName,
        isDeleted: githubBranches.isDeleted,
        htmlUrl: githubBranches.htmlUrl,
        taskId: githubBranches.taskId,
        taskKey: tasks.taskKey,
        createdByUserId: githubBranches.createdByUserId,
        createdAt: githubBranches.createdAt,
      })
      .from(githubBranches)
      .leftJoin(tasks, eq(githubBranches.taskId, tasks.taskId))
      .where(eq(githubBranches.projectId, projectId))
      .orderBy(desc(githubBranches.createdAt));

    // Try fetching live branches directly from GitHub API if connected
    let liveBranches: any[] = [];
    try {
      const [connection] = await db
        .select({
          githubRepoFullName: githubConnections.githubRepoFullName,
          githubAccessToken: githubConnections.githubAccessToken,
        })
        .from(githubConnections)
        .where(eq(githubConnections.projectId, projectId));

      if (connection && connection.githubAccessToken && connection.githubRepoFullName) {
        const token = decrypt(connection.githubAccessToken);
        const ghRes = await fetch(
          `https://api.github.com/repos/${connection.githubRepoFullName}/branches?per_page=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': 'DevSync-App',
            },
          }
        );

        if (ghRes.ok) {
          const ghData = (await ghRes.json()) as any[];
          liveBranches = ghData.map(b => ({
            id: `gh-${b.name}`,
            branchName: b.name,
            isDeleted: false,
            htmlUrl: `https://github.com/${connection.githubRepoFullName}/tree/${b.name}`,
            taskId: null,
            taskKey: null,
            createdByUserId: null,
            createdAt: new Date().toISOString(),
          }));
        }
      }
    } catch (e) {
      console.warn('Could not fetch live GitHub branches:', e);
    }

    // Merge DB branches with live GitHub branches (avoiding duplicates)
    const dbBranchNames = new Set(rows.map(b => b.branchName));
    const mergedBranches = [...rows];

    for (const lb of liveBranches) {
      if (!dbBranchNames.has(lb.branchName)) {
        mergedBranches.push(lb);
      }
    }

    res.json({ branches: mergedBranches });
  } catch (err) {
    console.error('Get GitHub branches error:', err);
    res.status(500).json({ error: 'Server error fetching branches.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — Re-run Failed CI Workflow
// ═══════════════════════════════════════════════════════════════════════════
// POST /api/workspaces/:slug/projects/:key/github/ci/:runId/rerun
export const retriggerWorkflow = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, runId } = req.params as Record<string, string>;

    const [connection] = await db
      .select({ githubRepoFullName: githubConnections.githubRepoFullName, githubAccessToken: githubConnections.githubAccessToken })
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection || !connection.githubAccessToken) {
      res.status(404).json({ error: 'No GitHub connection found.' });
      return;
    }

    const token = decrypt(connection.githubAccessToken);

    // Try rerun-failed-jobs first, if that fails try full rerun
    let ghRes = await githubApiFetch(
      `https://api.github.com/repos/${connection.githubRepoFullName}/actions/runs/${runId}/rerun-failed-jobs`,
      token,
      { method: 'POST' }
    ) as any;

    if (!ghRes.ok && (ghRes.status === 404 || ghRes.status === 422)) {
      // Fallback to full workflow rerun
      ghRes = await githubApiFetch(
        `https://api.github.com/repos/${connection.githubRepoFullName}/actions/runs/${runId}/rerun`,
        token,
        { method: 'POST' }
      ) as any;
    }

    if (!ghRes.ok && ghRes.status !== 201 && ghRes.status !== 202) {
      const errText = await ghRes.text();
      let errMsg = 'Failed to re-run workflow on GitHub.';
      try {
        const parsed = JSON.parse(errText);
        if (parsed.message) errMsg = `GitHub Error: ${parsed.message}`;
      } catch {
        if (errText) errMsg = `GitHub Error: ${errText}`;
      }
      console.error('GitHub rerun error:', ghRes.status, errText);
      res.status(ghRes.status || 502).json({ error: errMsg });
      return;
    }

    await logAuditAction({
      actorId: req.user!.userId,
      action: 'github.ci_rerun',
      entityType: 'project',
      entityId: projectId,
      newValues: { run_id: runId },
    });

    res.json({ message: 'Workflow re-run triggered on GitHub.' });
  } catch (err) {
    console.error('Retrigger workflow error:', err);
    res.status(500).json({ error: 'Server error re-running workflow.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — Get GitHub CI Logs
// ═══════════════════════════════════════════════════════════════════════════
// GET /api/workspaces/:slug/projects/:key/github/ci/:runId/logs
export const getWorkflowRunLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, runId } = req.params as Record<string, string>;

    const [connection] = await db
      .select({ githubRepoFullName: githubConnections.githubRepoFullName, githubAccessToken: githubConnections.githubAccessToken })
      .from(githubConnections)
      .where(eq(githubConnections.projectId, projectId))
      .limit(1);

    if (!connection || !connection.githubAccessToken) {
      res.status(404).json({ error: 'No GitHub connection found.' });
      return;
    }

    const token = decrypt(connection.githubAccessToken);

    // 1. Fetch jobs for the run
    const jobsRes = await githubApiFetch(
      `https://api.github.com/repos/${connection.githubRepoFullName}/actions/runs/${runId}/jobs`,
      token
    ) as any;

    if (!jobsRes.ok) {
      res.status(502).json({ error: 'Failed to fetch jobs for the workflow run.' });
      return;
    }

    const jobsData = await jobsRes.json();
    const jobs = jobsData.jobs || [];

    // Filter for failed jobs, or fallback to all jobs if none failed
    let targetJobs = jobs.filter((j: any) => j.conclusion === 'failure');
    if (targetJobs.length === 0) {
      targetJobs = jobs; // just show all if none failed
    }

    // 2. Fetch logs for target jobs
    const logsPromises = targetJobs.map(async (job: any) => {
      try {
        // GitHub logs endpoint redirects (302) to an S3/Azure URL.
        // Sending GitHub Authorization header to S3 causes S3 to reject with 400 Bad Request.
        // We use redirect: 'manual' and then fetch the redirected location without Auth header.
        const logRes = await fetch(
          `https://api.github.com/repos/${connection.githubRepoFullName}/actions/jobs/${job.id}/logs`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${token}`,
              'X-GitHub-Api-Version': '2022-11-28',
            },
            redirect: 'manual',
          }
        ) as unknown as globalThis.Response;

        let rawLogs = '';
        if (logRes.status === 302 || logRes.status === 301 || logRes.status === 307) {
          const redirectUrl = logRes.headers.get('location');
          if (redirectUrl) {
            const s3Res = await fetch(redirectUrl);
            if (s3Res.ok) {
              rawLogs = await s3Res.text();
            }
          }
        } else if (logRes.ok) {
          rawLogs = await logRes.text();
        }

        if (!rawLogs) {
          return { jobName: job.name, logs: 'Logs are expired, archived by GitHub, or unavailable.' };
        }

        // Clean ANSI escape sequences for crisp terminal viewing
        const cleanLogs = rawLogs.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
        return { jobName: job.name, logs: cleanLogs };
      } catch (e) {
        return { jobName: job.name, logs: 'Error fetching logs.' };
      }
    });

    const logsData = await Promise.all(logsPromises);
    res.json({ jobs: logsData });
  } catch (err) {
    console.error('Get workflow run logs error:', err);
    res.status(500).json({ error: 'Server error fetching workflow logs.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NEW: REST API — Get GitHub Activity for a Task
// ═══════════════════════════════════════════════════════════════════════════
// GET /api/workspaces/:slug/projects/:key/tasks/:taskKey/github-activity
export const getTaskGithubActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = (req.params.taskId || res.locals.taskId) as string;

    if (!taskId) {
      res.status(400).json({ error: 'Task ID is required.' });
      return;
    }

    const [linkedPRs, linkedIssues, linkedBranches, linkedCommitsData] = await Promise.all([
      db.select({
        id: githubPullRequests.id,
        prNumber: githubPullRequests.prNumber,
        title: githubPullRequests.title,
        state: githubPullRequests.state,
        htmlUrl: githubPullRequests.htmlUrl,
        headBranch: githubPullRequests.headBranch,
        baseBranch: githubPullRequests.baseBranch,
        mergedAt: githubPullRequests.mergedAt,
      }).from(githubPullRequests).where(eq(githubPullRequests.taskId, taskId)).orderBy(desc(githubPullRequests.createdAt)),

      db.select({
        id: githubIssues.id,
        githubIssueNumber: githubIssues.githubIssueNumber,
        title: githubIssues.title,
        state: githubIssues.state,
        htmlUrl: githubIssues.htmlUrl,
      }).from(githubIssues).where(eq(githubIssues.taskId, taskId)).orderBy(desc(githubIssues.createdAt)),

      db.select({
        id: githubBranches.id,
        branchName: githubBranches.branchName,
        isDeleted: githubBranches.isDeleted,
        htmlUrl: githubBranches.htmlUrl,
      }).from(githubBranches).where(eq(githubBranches.taskId, taskId)).orderBy(desc(githubBranches.createdAt)),

      db.select({
        id: githubCommits.id,
        commitSha: githubCommits.commitSha,
        messageHeadline: githubCommits.messageHeadline,
        authorName: githubCommits.authorName,
        committedAt: githubCommits.committedAt,
        url: githubCommits.url,
      }).from(githubCommits).where(eq(githubCommits.taskId, taskId)).orderBy(desc(githubCommits.committedAt)).limit(10),
    ]);

    res.json({
      pullRequests: linkedPRs,
      issues: linkedIssues,
      branches: linkedBranches,
      commits: linkedCommitsData,
    });
  } catch (err) {
    console.error('Get task GitHub activity error:', err);
    res.status(500).json({ error: 'Server error fetching task GitHub activity.' });
  }
};

