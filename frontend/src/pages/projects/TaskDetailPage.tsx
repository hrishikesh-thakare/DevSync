import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  GitCommitHorizontalIcon,
  Loader2Icon,
  PaperclipIcon,
  SendIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTaskDetailStore } from '@/store/taskDetailStore';
import { useProjectStore, useMyProjectRole } from '@/store/projectStore';
import { useSprintStore } from '@/store/sprintStore';
import { initialsOf } from '@/lib/initials';
import {
  ISSUE_TYPE_META,
  ISSUE_TYPE_ORDER,
  PRIORITY_META,
  PRIORITY_ORDER,
  STATUS_META,
  STATUS_ORDER,
} from '@/lib/taskMeta';
import type { IssueType, TaskPriority, TaskStatus } from '@/types/api';

const UNSET = '__none__';

export function TaskDetailPage() {
  const { slug = '', key = '', taskKey = '' } = useParams();
  const navigate = useNavigate();
  const { task, comments, attachments, commits, isLoading, error, fetchTask, patchTask, addComment, deleteTask, reset } =
    useTaskDetailStore();
  const members = useProjectStore((s) => s.members);
  const sprints = useSprintStore((s) => s.sprints);
  const fetchSprints = useSprintStore((s) => s.fetchSprints);
  const myRole = useMyProjectRole();
  const canEdit = myRole === 'project_admin' || myRole === 'developer';
  const canDelete = myRole === 'project_admin';

  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (slug && key && taskKey) void fetchTask(slug, key, taskKey);
    return () => reset();
  }, [slug, key, taskKey, fetchTask, reset]);

  useEffect(() => {
    if (slug && key) void fetchSprints(slug, key);
  }, [slug, key, fetchSprints]);

  const save = async (patch: Parameters<typeof patchTask>[3]) => {
    setSaving(true);
    try {
      await patchTask(slug, key, taskKey, patch);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the change.');
    } finally {
      setSaving(false);
    }
  };

  const postComment = async () => {
    const body = comment.trim();
    if (!body) return;
    setPosting(true);
    try {
      await addComment(slug, key, taskKey, body);
      setComment('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not post the comment.');
    } finally {
      setPosting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Skeleton className="h-8 w-96 rounded-lg" />
        <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Alert variant="destructive">
          <AlertTitle>{error ?? 'Task not found.'}</AlertTitle>
        </Alert>
        <Button className="mt-4" onClick={() => navigate(`/w/${slug}/projects/${key}`)}>
          Back to board
        </Button>
      </div>
    );
  }

  const type = ISSUE_TYPE_META[task.issueType];

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-sm text-muted-foreground">{task.taskKey}</span>
        <Badge variant="outline">
          <span aria-hidden="true">{type?.glyph}</span> {type?.label}
        </Badge>
        {saving ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Close task"
          onClick={() => navigate(`/w/${slug}/projects/${key}`)}
        >
          <XIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          <Input
            key={`title-${task.taskId}`}
            defaultValue={task.title}
            disabled={!canEdit}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (!next) {
                e.target.value = task.title;
                return;
              }
              if (next !== task.title) void save({ title: next });
            }}
            aria-label="Task title"
            className="h-auto border-0 bg-transparent px-0 text-xl font-medium shadow-none focus-visible:ring-0"
          />

          <section>
            <h2 className="mb-2 text-sm font-medium text-foreground">Description</h2>
            <Textarea
              key={`desc-${task.taskId}`}
              rows={5}
              defaultValue={task.descriptionText ?? ''}
              disabled={!canEdit}
              placeholder={canEdit ? 'Add a description…' : 'No description.'}
              onBlur={(e) => {
                if (e.target.value !== (task.descriptionText ?? '')) {
                  void save({ descriptionText: e.target.value });
                }
              }}
            />
          </section>

          {commits.length > 0 ? (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <GitCommitHorizontalIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                Linked commits ({commits.length})
              </h2>
              <ul className="space-y-1">
                {commits.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm">
                    <code className="font-mono text-xs text-muted-foreground">
                      {c.commitSha.slice(0, 7)}
                    </code>
                    <span className="min-w-0 flex-1 truncate">{c.messageHeadline}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.authorName}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {attachments.length > 0 ? (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <PaperclipIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                Attachments ({attachments.length})
              </h2>
              <ul className="space-y-1">
                {attachments.map((a) => (
                  <li key={a.fileId} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{a.uploaderName}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Discussion */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-foreground">Discussion</h2>

            {comments.length === 0 ? (
              <p className="mb-4 text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="mb-4 space-y-3">
                {comments.map((c) => (
                  <li key={c.commentId} className="flex gap-3">
                    <Avatar className="size-7 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {initialsOf(c.authorName ?? 'System')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{c.authorName ?? 'System'}</span>
                        {c.isSystem ? <Badge variant="outline">system</Badge> : null}
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </p>
                      <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground">{c.bodyText}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {canEdit ? (
              <div className="flex items-start gap-2">
                <Textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment…"
                  aria-label="Write a comment"
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter keeps the newline.
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void postComment();
                    }
                  }}
                />
                <Button onClick={() => void postComment()} disabled={!comment.trim() || posting}>
                  {posting ? (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <SendIcon className="size-4" aria-hidden="true" />
                  )}
                  <span className="sr-only">Post comment</span>
                </Button>
              </div>
            ) : null}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <SidebarSelect
            label="Status"
            value={task.status}
            disabled={!canEdit}
            onChange={(v) => void save({ status: v as TaskStatus })}
            options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))}
          />

          <SidebarSelect
            label="Priority"
            value={task.priority}
            disabled={!canEdit}
            onChange={(v) => void save({ priority: v as TaskPriority })}
            options={PRIORITY_ORDER.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
          />

          <SidebarSelect
            label="Type"
            value={task.issueType}
            disabled={!canEdit}
            onChange={(v) => void save({ issueType: v as IssueType })}
            options={ISSUE_TYPE_ORDER.map((t) => ({ value: t, label: ISSUE_TYPE_META[t].label }))}
          />

          <SidebarSelect
            label="Assignee"
            value={task.assigneeId ?? UNSET}
            disabled={!canEdit}
            onChange={(v) => void save({ assigneeId: v === UNSET ? null : v })}
            options={[
              { value: UNSET, label: 'Unassigned' },
              ...members.map((m) => ({ value: m.userId, label: m.displayName || m.fullName })),
            ]}
          />

          <SidebarSelect
            label="Sprint"
            value={task.sprintId ?? UNSET}
            disabled={!canEdit}
            onChange={(v) => void save({ sprintId: v === UNSET ? null : v })}
            options={[
              { value: UNSET, label: 'Backlog' },
              ...sprints
                .filter((s) => s.status !== 'closed')
                .map((s) => ({ value: s.sprintId, label: s.name })),
            ]}
          />

          <div>
            <label htmlFor="d-points" className="mb-1.5 block text-xs text-muted-foreground">
              Story points
            </label>
            <Input
              id="d-points"
              type="text"
              inputMode="numeric"
              disabled={!canEdit}
              defaultValue={task.storyPoints ?? ''}
              placeholder="—"
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const next = raw === '' ? null : Number(raw);
                if (next !== null && (!Number.isInteger(next) || next < 0 || next > 100)) {
                  toast.error('Story points must be a whole number from 0 to 100.');
                  e.target.value = String(task.storyPoints ?? '');
                  return;
                }
                if (next !== task.storyPoints) void save({ storyPoints: next });
              }}
            />
          </div>

          {task.aiDurationEstimate ? (
            <div className="rounded-lg bg-card p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <SparklesIcon className="size-3.5" aria-hidden="true" />
                AI estimate
              </p>
              <p className="mt-0.5 text-sm text-foreground">{task.aiDurationEstimate} hours</p>
            </div>
          ) : null}

          {task.labels?.length ? (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Labels</p>
              <div className="flex flex-wrap gap-1">
                {task.labels.map((l) => (
                  <Badge key={l} variant="secondary">
                    {l}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <Separator />
          <p className="text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
          </p>

          {canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  Delete task
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {task.taskKey}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The task is removed from the board and the backlog. Its comments and history are
                    kept, and the key is not reused.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      void deleteTask(slug, key, taskKey)
                        .then(() => {
                          toast.success(`${task.taskKey} deleted`);
                          navigate(`/w/${slug}/projects/${key}`);
                        })
                        .catch((err: unknown) =>
                          toast.error(err instanceof Error ? err.message : 'Could not delete.'),
                        );
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SidebarSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
