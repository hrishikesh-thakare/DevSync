import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  ClockIcon,
  FolderKanbanIcon,
  HistoryIcon,
  ShieldIcon,
  TriangleAlertIcon,
  UsersIcon,
} from 'lucide-react';

import { EmptyState, ErrorState } from '@/components/layout/PageState';
import { MemberAvatar } from '@/components/MemberAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
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
  /** Which layout to render — see the endpoint's note on why role alone is not enough. */
  persona: 'admin' | 'contributor' | 'viewer';
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

/**
 * The signed-in landing screen.
 *
 * Built to answer one question in about five seconds — *is anything waiting on
 * me?* — and to answer it differently depending on who is asking. It used to
 * render the same seven stacked panels to everyone (my work, sprints, at risk,
 * every project's progress bar, the full workload table, pending invites and an
 * activity feed), which is roughly twenty numbers competing for first place. An
 * admin had to read the whole page to find the two overdue tasks that actually
 * needed them, and a read-only viewer got a "My work" panel that is empty by
 * definition.
 *
 * So each persona gets a genuinely different default view rather than a shared
 * screen with sections switched off:
 *
 *   admin       Attention → At risk → My work → Sprints → a link strip
 *   contributor Attention → My work → Sprints
 *   viewer      Progress  → Sprints
 *
 * What was removed is not gone, only demoted: the projects grid, the workload
 * table and the activity feed each have a real page of their own, and the strip
 * at the bottom carries the one number that says whether visiting is worth it.
 * That is the progressive-disclosure trade — the dashboard answers "is
 * everything okay", the pages answer "why".
 */
export function WorkspaceHome() {
  const { slug = '' } = useParams();
  const { name, description, memberCount, myRole } = useCurrentWorkspaceStore();

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
      <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  // Fall back to the workspace role when the payload is missing (an error
  // state), so the page still renders something coherent.
  const persona =
    data?.persona ?? (myRole === 'owner' || myRole === 'admin' ? 'admin' : 'contributor');
  const isAdmin = persona === 'admin';
  const isViewer = persona === 'viewer';

  const myWork = data?.myWork;
  const openTotal = Object.values(myWork?.counts ?? {}).reduce((sum, n) => sum + n, 0);
  const atRisk = data?.atRisk;
  const inviteCount = data?.pendingInvites?.length ?? 0;

  // The single number the hero reports: what is actually waiting on *this*
  // person. An admin owns the workspace-wide risks; everyone else owns their
  // own dates. A viewer owns nothing, which is why they get progress instead.
  const attention = isAdmin
    ? (atRisk?.overdue.length ?? 0) + (atRisk?.stalled.length ?? 0) + inviteCount
    : (myWork?.overdue ?? 0) + (myWork?.dueSoon ?? 0);

  const hasSprints = (data?.sprints.length ?? 0) > 0;
  const hasRisk = (atRisk?.overdue.length ?? 0) + (atRisk?.stalled.length ?? 0) > 0;

  // A viewer's headline is delivery progress across the sprints they can see.
  const sprintTotals = (data?.sprints ?? []).reduce(
    (acc, s) => ({ done: acc.done + s.doneTasks, total: acc.total + s.totalTasks }),
    { done: 0, total: 0 },
  );
  const sprintPct =
    sprintTotals.total > 0 ? Math.round((sprintTotals.done / sprintTotals.total) * 100) : 0;

  const myWorkCard = myWork ? (
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
        {/* Three numbers, not six. The per-status split (to do / in progress /
            in review) moved to My Tasks, where it is a filter you can act on
            rather than a number you read past. */}
        <div className="flex flex-wrap gap-2">
          <Stat label="Open" value={openTotal} />
          <Stat label="Overdue" value={myWork.overdue} tone="danger" />
          <Stat label="Due soon" value={myWork.dueSoon} tone="warn" />
        </div>

        {myWork.tasks.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {myWork.tasks.map((task) => (
              <li key={task.taskId}>
                <TaskRow task={task} slug={slug} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={<CheckCircle2Icon />}
            title="Nothing assigned to you"
            description="Tasks assigned to you across this workspace show up here."
          />
        )}
      </CardContent>
    </Card>
  ) : null;

  const sprintsCard =
    data && data.sprints.length > 0 ? (
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
    ) : null;

  const needsAttentionCard =
    isAdmin && hasRisk ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            Needs attention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {atRisk!.overdue.length > 0 ? (
            <RiskGroup
              title={`Overdue (${atRisk!.overdue.length})`}
              tasks={atRisk!.overdue}
              slug={slug}
            />
          ) : null}
          {atRisk!.stalled.length > 0 ? (
            <RiskGroup
              title={`Stalled in review (${atRisk!.stalled.length})`}
              tasks={atRisk!.stalled}
              slug={slug}
            />
          ) : null}
        </CardContent>
      </Card>
    ) : null;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
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
        </div>
      </section>

      {error ? <ErrorState message={error} /> : null}

      {isViewer && !hasSprints ? null : (
        <Headline
          isViewer={isViewer}
          attention={attention}
          isAdmin={isAdmin}
          sprintPct={sprintPct}
          sprintCount={data?.sprints.length ?? 0}
        />
      )}

      {isViewer ? (
        <div className="grid items-start gap-6 md:grid-cols-2">
          {sprintsCard}
          {myWork && myWork.tasks.length > 0 ? myWorkCard : null}
          {!hasSprints && (!myWork || myWork.tasks.length === 0) ? (
            <div className="md:col-span-2">
              <EmptyState
                icon={<FolderKanbanIcon />}
                title="No active sprints"
                description="When a project starts a sprint, its progress appears here."
                action={
                  <Button asChild variant="outline">
                    <Link to={`/w/${slug}/projects`}>Browse projects</Link>
                  </Button>
                }
              />
            </div>
          ) : null}
        </div>
      ) : isAdmin ? (
        <div
          className={cn(
            'grid items-start gap-6',
            hasRisk ? 'lg:grid-cols-3 md:grid-cols-2' : 'md:grid-cols-2'
          )}
        >
          {needsAttentionCard}
          {sprintsCard}
          {myWorkCard}
        </div>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-2">
          {myWorkCard}
          {sprintsCard}
        </div>
      )}

      {/* Progressive disclosure: the count says whether it is worth a click,
          the page behind it does the explaining. This replaces the projects
          grid, the workload table and the activity feed that used to be
          rendered in full on this screen. */}
      {isAdmin ? (
        <nav aria-label="Workspace management" className="grid gap-3 sm:grid-cols-3">
          <ManageLink
            to={`/w/${slug}/members`}
            icon={<UsersIcon className="size-4" aria-hidden="true" />}
            label="Members"
            detail={
              inviteCount > 0
                ? `${inviteCount} invite${inviteCount === 1 ? '' : 's'} pending`
                : `${memberCount} active`
            }
            highlight={inviteCount > 0}
          />
          <ManageLink
            to={`/w/${slug}/analytics`}
            icon={<BarChart3Icon className="size-4" aria-hidden="true" />}
            label="Analytics"
            detail={`${data?.projects?.length ?? 0} active projects`}
          />
          <ManageLink
            to={`/w/${slug}/activity`}
            icon={<HistoryIcon className="size-4" aria-hidden="true" />}
            label="Activity"
            detail="Full audit trail"
          />
        </nav>
      ) : null}
    </div>
  );
}

/**
 * The one line the page exists to deliver.
 *
 * Deliberately a sentence rather than a number in a box: "2 things need you"
 * is understood without a legend, where a bare `2` under the label "Attention"
 * is not. Zero is a real answer here and gets its own affirmative phrasing —
 * an all-clear state that reads as success is what makes the count worth
 * checking on the days it is not zero.
 */
function Headline({
  isViewer,
  isAdmin,
  attention,
  sprintPct,
  sprintCount,
}: {
  isViewer: boolean;
  isAdmin: boolean;
  attention: number;
  sprintPct: number;
  sprintCount: number;
}) {
  if (isViewer) {
    return (
      <div className="rounded-2xl border bg-card px-5 py-4">
        <p className="text-lg font-medium text-foreground">
          {sprintCount === 0
            ? 'No sprints are running'
            : `Sprint work is ${sprintPct}% complete`}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {sprintCount === 0
            ? 'Nothing is in flight in the projects you can see.'
            : `Across ${sprintCount} active sprint${sprintCount === 1 ? '' : 's'}.`}
        </p>
      </div>
    );
  }

  const clear = attention === 0;

  return (
    <div
      className={cn(
        'rounded-2xl border px-5 py-4',
        clear ? 'bg-card' : 'border-destructive/40 bg-destructive/5',
      )}
    >
      <p
        className={cn(
          'text-lg font-medium',
          clear ? 'text-foreground' : 'text-destructive',
        )}
      >
        {clear
          ? "You're all clear"
          : `${attention} thing${attention === 1 ? '' : 's'} need${attention === 1 ? 's' : ''} your attention`}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {clear
          ? isAdmin
            ? 'Nothing is overdue, stalled in review, or waiting on an invite.'
            : 'Nothing of yours is overdue or due in the next few days.'
          : isAdmin
            ? 'Overdue work, stalled reviews and outstanding invites are listed below.'
            : 'Your overdue and soon-due tasks are listed below.'}
      </p>
    </div>
  );
}

/** One tile in the admin link strip: a label, a live number, and a destination. */
function ManageLink({
  to,
  icon,
  label,
  detail,
  highlight,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-accent/50',
        highlight && 'border-amber-500/40 bg-amber-500/5',
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ArrowRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
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

/** Only rendered with tasks in it — the card above gates on that. */
function RiskGroup({
  title,
  tasks,
  slug,
}: {
  title: string;
  tasks: DashboardTask[];
  slug: string;
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-medium text-foreground">{title}</h3>
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
    </div>
  );
}
