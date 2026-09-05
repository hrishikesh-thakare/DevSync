/**
 * Response shapes returned by the DevSync backend.
 *
 * These mirror the actual `res.json(...)` payloads in `backend/src/modules/**`,
 * not the Drizzle table definitions — the controllers hand-pick columns and
 * rename a few, so the wire shape and the table shape are not the same thing.
 * Add to this file as each slice wires up new endpoints.
 */

// ─── Roles ───────────────────────────────────────────────────────────────────

// No 'guest' tier: the backend never implemented permissions for one (every
// role check is 'owner' | 'admin' | 'member'), so the option was removed
// rather than left able to silently lock someone out.
export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type ProjectRole = 'project_admin' | 'developer' | 'viewer';
export type MemberState = 'active' | 'invited' | 'deactivated';
export type Presence = 'online' | 'away' | 'offline';

// ─── Auth ────────────────────────────────────────────────────────────────────

/** `POST /auth/login` and `/auth/oauth/callback` return this much. */
export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  presence?: Presence;
  preferences?: Record<string, unknown>;
}

export interface AuthResponse {
  message: string;
  accessToken: string;
  user: AuthUser;
  /** Only present when the server runs with NODE_ENV !== 'production'. */
  verificationUrl?: string;
}

/**
 * `GET /auth/me` returns only what `requireAuth` puts on `req.user` — no
 * avatarUrl, displayName or presence. Source those from the workspace member
 * list instead of assuming this is a full profile.
 */
export interface MeResponse {
  user: Pick<AuthUser, 'userId' | 'email' | 'fullName'>;
}

// ─── Workspaces ──────────────────────────────────────────────────────────────

/** A row from `GET /workspaces` — workspace columns joined with the caller's membership. */
export interface WorkspaceSummary {
  workspaceId: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  description: string | null;
  ownerId: string | null;
  createdAt: string;
  role: WorkspaceRole;
  state: MemberState;
  joinedAt: string;
}

/** The full workspace row from `GET /workspaces/:slug`. */
export interface Workspace {
  workspaceId: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  description: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * A member row from `GET /workspaces/:slug` and `/workspaces/:slug/members`.
 * `presence`/`statusText` are present on the initial payload but
 * also arrive later over the socket as `user_presence_updated`.
 */
export interface WorkspaceMember {
  id: string;
  userId: string;
  role: WorkspaceRole;
  state: MemberState;
  joinedAt: string;
  fullName: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  presence?: Presence;
  statusText?: string | null;
}

// ─── Projects ────────────────────────────────────────────────────────────────

/** A row from `GET /workspaces/:slug/projects`. */
export interface ProjectSummary {
  projectId: string;
  name: string;
  key: string;
  description: string | null;
  iconUrl: string | null;
  status: 'active' | 'archived';
  issueCounter: number;
  createdAt: string;
  leadName: string | null;
  leadAvatar: string | null;
}

// ─── Channels ────────────────────────────────────────────────────────────────

export type ChannelType = 'public' | 'private' | 'dm' | 'group_dm';

/** A row from `GET /workspaces/:slug/channels`. */
export interface Channel {
  channelId: string;
  workspaceId: string;
  projectId: string | null;
  name: string;
  slug: string;
  description: string | null;
  type: ChannelType;
  isDefault: boolean;
  isArchived: boolean;
  isAnnouncementOnly: boolean;
  createdBy: string | null;
  createdAt: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationType =
  | 'task_assigned' | 'task_unassigned' | 'task_status_changed'
  | 'task_mentioned' | 'task_commented'
  | 'sprint_started' | 'sprint_closed'
  | 'channel_mentioned' | 'dm_received'
  | 'ci_passed' | 'ci_failed'
  | 'commit_linked' | 'commit_unlinked'
  | 'pr_opened' | 'pr_merged'
  | 'workspace_invited' | 'project_member_added';

/** A row from `GET /notifications`. */
export interface AppNotification {
  notificationId: string;
  type: NotificationType;
  entityType: string;
  entityId: string;
  title: string;
  body: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  actorAvatar: string | null;
  channelId: string | null;
}

// ─── Projects (detail) ───────────────────────────────────────────────────────

/** The full project row from `GET /workspaces/:slug/projects/:key`. */
export interface Project {
  projectId: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  iconUrl: string | null;
  leadUserId: string | null;
  githubRepoOwner: string | null;
  githubRepoName: string | null;
  issueCounter: number;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/** A row from `GET .../projects/:key/members`. */
export interface ProjectMember {
  id: string;
  userId: string;
  role: ProjectRole;
  addedAt: string;
  fullName: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type IssueType = 'epic' | 'story' | 'task' | 'bug' | 'subtask';

/**
 * A row from `GET .../tasks`. The list endpoint hand-picks columns and joins the
 * assignee, so it is narrower than the full task returned by `GET .../tasks/:taskKey`.
 * Rows arrive ordered by `rank` ascending.
 */
export interface TaskSummary {
  taskId: string;
  taskKey: string;
  title: string;
  issueType: IssueType;
  status: TaskStatus;
  priority: TaskPriority;
  /** Fractional index used for drag ordering. */
  rank: string | null;
  dueDate: string | null;
  labels: string[];
  storyPoints: number | null;
  sprintId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  reporterId: string | null;
  linkedCommitsCount: number;
  createdAt: string;
  parentTaskId: string | null;
  epicId: string | null;
}

/** Body accepted by `POST .../tasks` — mirrors the `.strict()` createTaskSchema. */
export interface CreateTaskInput {
  title: string;
  descriptionText?: string;
  issueType?: IssueType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  sprintId?: string | null;
  storyPoints?: number | null;
  labels?: string[];
}

/** A sprint row from `GET .../sprints`, with the server-computed rollup. */
export interface Sprint {
  sprintId: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: 'future' | 'active' | 'closed';
  startDate: string | null;
  endDate: string | null;
  sequenceNumber: number;
  capacityPoints: number | null;
  closedAt: string | null;
  velocityIssues: number | null;
  /**
   * Written by the Gemini retrospective on sprint close. `listSprints` selects
   * every column, so these have always been on the wire — this interface just
   * never declared them, which is why the report only ever reached people as a
   * chat message.
   */
  aiSummary: {
    summary: string;
    highlights: string[];
    generatedAt: string;
  } | null;
  aiContributionReport:
    | {
        userId: string | null;
        fullName: string;
        summary: string;
        tasksCompleted: number;
      }[]
    | null;
  stats?: {
    taskCount: number;
    totalPoints: number;
    completedPoints: number;
    completedCount: number;
  };
}

/** The full task row from `GET .../tasks/:taskKey`. */
export interface Task {
  taskId: string;
  taskKey: string;
  projectId: string;
  parentTaskId: string | null;
  epicId: string | null;
  sprintId: string | null;
  title: string;
  description: unknown;
  descriptionText: string | null;
  issueType: IssueType;
  status: TaskStatus;
  priority: TaskPriority;
  reporterId: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  labels: string[];
  rank: string | null;
  storyPoints: number | null;
  aiDurationEstimate: string | null;
  linkedCommitsCount: number;
  discussionThreadId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A row from `GET .../tasks/:taskKey/comments`. */
export interface TaskComment {
  commentId: string;
  threadId: string | null;
  bodyText: string;
  createdAt: string;
  isSystem: boolean;
  systemType: string | null;
  authorId: string | null;
  authorName: string | null;
}

/** A row from `GET .../tasks/:taskKey/attachments`. */
export interface TaskAttachment {
  fileId: string;
  filename: string;
  mimetype: string | null;
  sizeBytes: number | null;
  filetype: string | null;
  createdAt: string;
  uploaderId: string | null;
  uploaderName: string | null;
  uploaderAvatar: string | null;
}

/** A row from `GET .../projects/:key/labels`. */
export interface ProjectLabel {
  labelId: string;
  name: string;
  color: string;
  createdAt: string;
  usageCount: number;
}

/** A commit linked to a task. */
export interface LinkedCommit {
  id: string;
  commitSha: string;
  messageHeadline: string;
  authorName: string | null;
  authorGithubLogin: string | null;
  committedAt: string | null;
  branchName: string | null;
  url: string | null;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface MessageReaction {
  messageId: string;
  userId: string;
  emoji: string;
  userName: string | null;
}

/** A row from `GET .../channels/:channelId/messages` (oldest first). */
export interface ChatMessage {
  messageId: string;
  bodyText: string;
  bodyBlocks: unknown;
  isSystem: boolean;
  systemType: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  authorId: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  threadId: string | null;
  reactions: MessageReaction[];
}

/** A member row from `GET .../channels/:channelId`. */
export interface ChannelMember {
  userId: string;
  joinedAt: string;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
  presence: Presence | null;
}

// ─── GitHub ──────────────────────────────────────────────────────────────────

export interface GithubConnection {
  connectionId: string;
  githubRepoFullName: string;
  defaultBranch: string | null;
  webhookId: number | null;
  createdAt: string;
  connectedByName: string | null;
  connectedByAvatar: string | null;
  webhookStatus: 'active' | 'inactive';
}

export interface GithubCommit {
  id: string;
  commitSha: string;
  messageHeadline: string;
  authorName: string | null;
  authorGithubLogin: string | null;
  authorUserId: string | null;
  authorAvatar: string | null;
  committedAt: string | null;
  branchName: string | null;
  url: string | null;
  taskId: string | null;
  taskKey: string | null;
}

export interface GithubCiRun {
  id: string;
  workflowName: string | null;
  runId: number;
  status: string | null;
  conclusion: string | null;
  headBranch: string | null;
  headSha: string | null;
  htmlUrl: string | null;
  triggeredAt: string | null;
  completedAt: string | null;
}

export interface GithubPullRequest {
  id: string;
  prNumber: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  htmlUrl: string | null;
  headBranch: string | null;
  baseBranch: string | null;
  authorGithubLogin: string | null;
  taskId: string | null;
  taskKey: string | null;
  mergedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface GithubIssue {
  id: string;
  githubIssueNumber: number;
  title: string;
  body: string | null;
  state: string;
  htmlUrl: string | null;
  authorGithubLogin: string | null;
  labels: unknown;
  taskId: string | null;
  taskKey: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface GithubBranch {
  id: string;
  branchName: string;
  isDeleted: boolean;
  htmlUrl: string | null;
  taskId: string | null;
  taskKey: string | null;
  createdByUserId: string | null;
  createdAt: string | null;
}

export interface GithubRepoOption {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  url: string;
  defaultBranch: string;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

/**
 * A row from `GET /auth/sessions` — one live refresh token.
 *
 * `deviceInfo` is a `jsonb` column written by `createRefreshToken`, which only
 * ever stores these two fields, both defaulting to the string 'unknown'.
 */
export interface UserSession {
  tokenId: string;
  deviceInfo: { userAgent?: string; ip?: string } | null;
  issuedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

// ─── Audit ───────────────────────────────────────────────────────────────────

/**
 * A row from `GET /audit/:entityType/:entityId`.
 *
 * `oldValues` / `newValues` are free-form `jsonb` written per call site, so
 * they carry no fixed shape — they are rendered structurally, never keyed by
 * an assumed field.
 */
export interface AuditLogEntry {
  logId: string;
  action: string;
  oldValues: unknown;
  newValues: unknown;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  actorAvatar: string | null;
}
