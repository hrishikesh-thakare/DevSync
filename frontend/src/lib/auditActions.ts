/**
 * Human-readable phrasing for the `action` strings written by `logAuditAction`.
 *
 * The set is fixed — every call site in the backend passes a literal — so this
 * is an exhaustive map rather than a guess. Anything unrecognised falls back to
 * a readable rendering of the raw string, which keeps a newly added action
 * legible instead of blank.
 */
const ACTION_LABELS: Record<string, string> = {
  'user.registered': 'created their account',
  'user.login': 'signed in',
  'user.password_changed': 'changed their password',
  'user.password_reset_requested': 'requested a password reset',
  'user.password_reset': 'reset their password',
  'user.email_verified': 'verified their email',
  'user.session_revoked': 'revoked a session',
  'user.sessions_revoked_others': 'signed out their other devices',

  'workspace.created': 'created the workspace',
  'workspace.updated': 'updated the workspace',
  'workspace.deleted': 'deleted the workspace',

  'workspace_invite.created': 'sent an invitation',
  'workspace_member.invited': 'invited a member',
  'workspace_member.invite_accepted': 'accepted an invitation',
  'workspace_member.reactivated': 'reactivated a member',
  'workspace_member.role_changed': 'changed a member role',
  'workspace_member.removed': 'removed a member',
  'workspace_member.left': 'left the workspace',

  'project.created': 'created a project',
  'project.updated': 'updated a project',
  'project.archived': 'archived a project',
  'project_member.added': 'added a project member',
  'project_member.role_changed': 'changed a project role',
  'project_member.removed': 'removed a project member',

  'task.created': 'created a task',
  'task.updated': 'updated a task',
  'task.deleted': 'deleted a task',
  'task.reordered': 'reordered a task',
  'task.attachment_added': 'attached a file',
  'task.attachment_removed': 'removed an attachment',

  'sprint.created': 'created a sprint',
  'sprint.started': 'started a sprint',
  'sprint.closed': 'closed a sprint',
  'sprint.updated': 'updated a sprint',
  'sprint.deleted': 'deleted a sprint',

  'channel.created': 'created a channel',
  'channel.updated': 'updated a channel',
  'channel.archived': 'archived a channel',
  'channel.deleted': 'deleted a channel',
  'channel.member_added': 'joined a channel',
  'channel.member_removed': 'left a channel',

  'project_label.created': 'created a label',
  'project_label.updated': 'updated a label',
  'project_label.deleted': 'deleted a label',
};

export function describeAuditAction(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  // e.g. "github.repo_connected" → "github repo connected"
  return action.replace(/[._]/g, ' ');
}

/**
 * Summarises the `oldValues` → `newValues` diff as short "field: a → b" strings.
 *
 * Both columns are free-form `jsonb` written per call site, so this stays
 * structural: compare the union of keys, skip anything that did not move, and
 * render values shallowly. Objects are shown as JSON rather than "[object
 * Object]".
 */
export function summariseChanges(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
): string[] {
  if (!oldValues && !newValues) return [];

  // A pure create or delete has one side only — list its fields rather than
  // rendering every one as "undefined → x".
  if (!oldValues) return Object.entries(newValues ?? {}).map(([k, v]) => `${label(k)}: ${show(v)}`);
  if (!newValues) return Object.entries(oldValues).map(([k, v]) => `${label(k)}: ${show(v)}`);

  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  const out: string[] = [];
  for (const key of keys) {
    const before = show(oldValues[key]);
    const after = show(newValues[key]);
    if (before === after) continue;
    out.push(`${label(key)}: ${before || '—'} → ${after || '—'}`);
  }
  return out;
}

/** snake_case columns are what the audit rows store; humanise them. */
function label(key: string): string {
  return key.replace(/_/g, ' ');
}

function show(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
