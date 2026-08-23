import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRightIcon,
  ClockIcon,
  FolderKanbanIcon,
  HistoryIcon,
  MailIcon,
  ShieldIcon,
  TriangleAlertIcon,
  UsersIcon,
} from 'lucide-react';

import { EmptyState } from '@/components/layout/PageState';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MemberAvatar } from '@/components/MemberAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { apiFetch } from '@/lib/api';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { initialsOf } from '@/lib/initials';
import { describeAuditAction } from '@/lib/auditActions';
import { STATUS_META } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/types/api';

interface DashboardTask {
  taskId: string;
  taskKey: string;
  title: string;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  projectKey: string | null;
  projectName: string | null;
  assigneeName?: string | null;
  assigneeAvatar?: string | null;
  updatedAt?: string | null;
}

interface SprintSummary {
  sprintId: string;
  name: string;
  goal: string | null;
  endDate: string | null;
  daysRemaining: number | null;
  totalTasks: number;
  doneTasks: number;
  totalPoints: number;
  donePoints: number;
  capacityPoints: number | null;
  projectKey: string | null;
  projectName: string | null;
}

interface ProjectRollup {
  projectId: string;
  key: string;
  name: string;
  totalTasks: number;
  doneTasks: number;
  percentComplete: number;
  memberCount: number;
  activeSprintName: string | null;
}

interface Dashboard {
  role: 'owner' | 'admin' | 'member';
  myWork: {
    counts: Record<string, number>;
    overdue: number;
    dueSoon: number;
    tasks: DashboardTask[];
  };
  sprints: SprintSummary[];
  /** Admin and owner only — absent from a member's payload entirely. */
  projects?: ProjectRollup[];
  atRisk?: { overdue: DashboardTask[]; stalled: DashboardTask[] };
  workload?: { userId: string; fullName: string; avatarUrl: string | null; openTasks: number }[];
  pendingInvites?: {
    inviteId: string;
    email: string;
    role: string;
    expiresAt: string;
    invitedByName: string | null;
  }[];
  activity?: {
    logId: string;
    action: string;
    createdAt: string;
    actorName: string | null;
    actorAvatar: string | null;
  }[];
}

export function WorkspaceHome() {
  const { slug = '' } = useParams();
  const { name, description, memberCount, myRole, members } = useCurrentWorkspaceStore();

  // The dashboard payload carries no presence, but the workspace roster does —
  // and it stays current because `user_presence_updated` merges into this store.
  const presenceOf = (userId: string) =>
    members.find((m) => m.userId === userId)?.presence ?? null;

  const [data, setData] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await apiFetch(`/workspaces/${slug}/dashboard`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [slug, load]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const open = data?.myWork.counts ?? {};
  const openTotal = Object.values(open).reduce((sum, n) => sum + n, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <section>
        <h1 className="text-2xl font-medium text-foreground">{name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description || 'Everything that needs your attention, in one place.'}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="gap-1.5">
            <ShieldIcon className="size-3.5" aria-hidden="true" />
            {myRole}
          </Badge>
          <span className="flex items-center gap-1.5">
            <UsersIcon className="size-4" aria-hidden="true" />
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
          <span className="flex items-center gap-1.5">
            <FolderKanbanIcon className="size-4" aria-hidden="true" />
            {data?.projects?.length ?? '—'} active projects
          </span>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      {/* ── My work: the one section every persona sees first ─────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>My work</CardTitle>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/w/${slug}/my-tasks`}>
                View all
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Stat label="Open" value={openTotal} />
            {(['todo', 'in_progress', 'in_review'] as TaskStatus[]).map((status) => (
              <Stat
                key={status}
                label={STATUS_META[status]?.label ?? status}
                value={open[status] ?? 0}
                dot={STATUS_META[status]?.dot}
              />
            ))}
            <Stat label="Overdue" value={data?.myWork.overdue ?? 0} tone="danger" />
            <Stat label="Due soon" value={data?.myWork.dueSoon ?? 0} tone="warn" />
          </div>

          {data && data.myWork.tasks.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {data.myWork.tasks.map((task) => (
                <li key={task.taskId}>
                  <TaskRow task={task} slug={slug} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing assigned to you right now.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Sprint progress. Current ratio only — see the endpoint's note on
             why there is no burndown line here. ───────────────────────────── */}
      {data && data.sprints.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Active sprints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {data.sprints.map((sprint) => {
              const pct =
                sprint.totalPoints > 0
                  ? Math.round((sprint.donePoints / sprint.totalPoints) * 100)
                  : sprint.totalTasks > 0
                    ? Math.round((sprint.doneTasks / sprint.totalTasks) * 100)
                    : 0;
              const late = sprint.daysRemaining != null && sprint.daysRemaining < 0;

              return (
                <div key={sprint.sprintId}>
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
                    <Link
                      to={`/w/${slug}/projects/${sprint.projectKey}/sprints`}
                      className="text-sm font-medium text-foreground hover:underline"
                    >
                      {sprint.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{sprint.projectName}</span>
                    <span
                      className={cn(
                        'ml-auto text-xs',
                        late ? 'font-medium text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {sprint.daysRemaining == null
                        ? 'No end date'
                        : late
                          ? `${Math.abs(sprint.daysRemaining)}d overdue`
                          : `${sprint.daysRemaining}d left`}
                    </span>
                  </div>
                  <Progress value={pct} />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {sprint.doneTasks}/{sprint.totalTasks} tasks
                    {sprint.totalPoints > 0
                      ? ` · ${sprint.donePoints}/${sprint.totalPoints} points`
                      : ' · unestimated'}
                    {' · '}
                    {pct}% complete
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* ── Lead and owner sections ──────────────────────────────────────── */}
      {isAdmin && data?.atRisk ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlertIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              At risk
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RiskGroup
              title={`Overdue (${data.atRisk.overdue.length})`}
              tasks={data.atRisk.overdue}
              slug={slug}
              emptyText="Nothing is past its due date."
            />
            <RiskGroup
              title={`Stalled in review (${data.atRisk.stalled.length})`}
              tasks={data.atRisk.stalled}
              slug={slug}
              emptyText="Nothing has been sitting in review."
            />
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {data?.projects ? (
            <Card>
              <CardHeader>
                <CardTitle>Projects at a glance</CardTitle>
              </CardHeader>
              <CardContent>
                {data.projects.length === 0 ? (
                  <EmptyRow>No active projects.</EmptyRow>
                ) : (
                  <ul className="space-y-3">
                    {data.projects.map((project) => (
                      <li key={project.projectId}>
                        <div className="mb-1 flex items-center gap-2">
                          <Link
                            to={`/w/${slug}/projects/${project.key}`}
                            className="truncate text-sm text-foreground hover:underline"
                          >
                            {project.name}
                          </Link>
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {project.percentComplete}%
                          </span>
                        </div>
                        <Progress value={project.percentComplete} />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {project.doneTasks}/{project.totalTasks} done · {project.memberCount}{' '}
                          {project.memberCount === 1 ? 'member' : 'members'}
                          {project.activeSprintName ? ` · ${project.activeSprintName}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {data?.workload ? (
            <Card>
              <CardHeader>
                <CardTitle>Workload</CardTitle>
              </CardHeader>
              <CardContent>
                {data.workload.length === 0 ? (
                  <EmptyRow>Nothing is assigned yet.</EmptyRow>
                ) : (
                  <ul className="space-y-2">
                    {data.workload.map((member) => (
                      <li key={member.userId} className="flex items-center gap-3">
                        <MemberAvatar
                          member={{ ...member, presence: presenceOf(member.userId) }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                          {member.fullName}
                        </span>
                        <Badge variant="outline">{member.openTasks} open</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {data?.pendingInvites ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MailIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  Pending invites
                </CardTitle>
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/w/${slug}/members`}>
                      Members
                      <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {data.pendingInvites.length === 0 ? (
                  <EmptyRow>No invites are outstanding.</EmptyRow>
                ) : (
                  <ul className="space-y-2">
                    {data.pendingInvites.map((invite) => (
                      <li key={invite.inviteId} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {invite.email}
                        </span>
                        <Badge variant="outline">{invite.role}</Badge>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          expires{' '}
                          {formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {data?.activity ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HistoryIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.activity.length === 0 ? (
                  <EmptyRow>No workspace activity recorded yet.</EmptyRow>
                ) : (
                  <ul className="space-y-2">
                    {data.activity.map((entry) => (
                      <li key={entry.logId} className="flex items-start gap-2 text-sm">
                        <Avatar className="mt-0.5 size-6 shrink-0">
                          {entry.actorAvatar ? <AvatarImage src={entry.actorAvatar} alt="" /> : null}
                          <AvatarFallback className="text-[9px]">
                            {initialsOf(entry.actorName ?? '?')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="text-foreground">
                            {entry.actorName ?? 'Someone'}
                          </span>{' '}
                          <span className="text-muted-foreground">
                            {describeAuditAction(entry.action)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  dot,
  tone,
}: {
  label: string;
  value: number;
  dot?: string;
  tone?: 'danger' | 'warn';
}) {
  const muted = value === 0;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        tone === 'danger' && !muted && 'border-destructive/40 bg-destructive/5',
        tone === 'warn' && !muted && 'border-amber-500/40 bg-amber-500/5',
      )}
    >
      {dot ? <span className={cn('size-2 rounded-full', dot)} aria-hidden="true" /> : null}
      <span
        className={cn(
          'text-lg font-medium tabular-nums',
          muted ? 'text-muted-foreground' : 'text-foreground',
          tone === 'danger' && !muted && 'text-destructive',
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function TaskRow({ task, slug }: { task: DashboardTask; slug: string }) {
  const overdue = task.dueDate ? new Date(task.dueDate) < new Date() : false;
  return (
    <Link
      to={`/w/${slug}/projects/${task.projectKey}/tasks/${task.taskKey}`}
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
    >
      <span
        className={cn('size-2 shrink-0 rounded-full', STATUS_META[task.status]?.dot)}
        aria-hidden="true"
      />
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{task.taskKey}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{task.title}</span>
      {task.dueDate ? (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 text-xs',
            overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          <ClockIcon className="size-3.5" aria-hidden="true" />
          {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
        </span>
      ) : null}
    </Link>
  );
}

function RiskGroup({
  title,
  tasks,
  slug,
  emptyText,
}: {
  title: string;
  tasks: DashboardTask[];
  slug: string;
  emptyText: string;
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-medium text-foreground">{title}</h3>
      {tasks.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tasks.map((task) => (
            <li key={task.taskId} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <TaskRow task={task} slug={slug} />
              </div>
              {task.assigneeName ? (
                <span className="mr-3 shrink-0">
                  <MemberAvatar
                    size="sm"
                    member={{ fullName: task.assigneeName, avatarUrl: task.assigneeAvatar }}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Compact empty state for the dashboard's card panels.
 *
 * Delegates to the shared component so the typography matches the rest of the
 * app, but stays borderless and iconless — a full bordered Empty block inside
 * a small card reads as a nested box.
 */
function EmptyRow({ children }: { children: string }) {
  return <EmptyState compact title={children} className="py-6" />;
}
