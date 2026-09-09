import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { CalendarClockIcon } from 'lucide-react';
import { useSprintStore } from '@/store/sprintStore';
import { useTasksQuery, byRank, EMPTY_TASKS } from '@/queries/tasks';
import { STATUS_META, STATUS_ORDER } from '@/lib/taskMeta';
import { PRIORITY_META } from '@/lib/taskMeta';
import { MemberAvatar } from '@/components/MemberAvatar';
import { cn } from '@/lib/utils';

/**
 * Read-only view of one sprint's tasks, grouped by status.
 *
 * Deliberately not drag-enabled: moving a card here would need the same rank
 * arithmetic as the board, and the board already owns that. This screen answers
 * "how is the sprint going", which the board cannot.
 */
export function ActiveSprintBoard() {
  const { slug = '', key = '', sprintId } = useParams();
  const { sprints, isLoading: sprintsLoading, fetchSprints } = useSprintStore();
  const { data: tasks = EMPTY_TASKS, isPending: tasksLoading } = useTasksQuery(slug, key);

  useEffect(() => {
    if (slug && key) void fetchSprints(slug, key);
  }, [slug, key, fetchSprints]);

  const sprint = useMemo(
    () =>
      sprintId
        ? sprints.find((s) => s.sprintId === sprintId)
        : sprints.find((s) => s.status === 'active'),
    [sprints, sprintId],
  );

  const columns = useMemo(() => {
    const map = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as typeof tasks])) as Record<
      (typeof STATUS_ORDER)[number],
      typeof tasks
    >;
    if (!sprint) return map;
    for (const t of tasks) if (t.sprintId === sprint.sprintId) map[t.status]?.push(t);
    for (const s of STATUS_ORDER) map[s].sort(byRank);
    return map;
  }, [tasks, sprint]);

  if (sprintsLoading || tasksLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Skeleton className="mb-4 h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!sprint) {
    return (
      <Empty className="min-h-[50svh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarClockIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No active sprint</EmptyTitle>
          <EmptyDescription>
            Start a sprint from the sprints tab to track it here.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to={`/w/${slug}/projects/${key}/sprints`}>Go to sprints</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const stats = sprint.stats;
  const pct =
    stats && stats.totalPoints > 0
      ? Math.round((stats.completedPoints / stats.totalPoints) * 100)
      : stats && stats.taskCount > 0
        ? Math.round((stats.completedCount / stats.taskCount) * 100)
        : 0;

  const daysLeft = sprint.endDate
    ? differenceInCalendarDays(new Date(sprint.endDate), new Date())
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <Card className="mb-6">
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-medium text-foreground">{sprint.name}</h1>
            <Badge variant={sprint.status === 'active' ? 'default' : 'secondary'}>{sprint.status}</Badge>
            {daysLeft !== null ? (
              <span className="ml-auto text-sm text-muted-foreground">
                {daysLeft > 0
                  ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`
                  : daysLeft === 0
                    ? 'Ends today'
                    : `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'}`}
              </span>
            ) : null}
          </div>

          {sprint.goal ? <p className="text-sm text-muted-foreground">{sprint.goal}</p> : null}

          {sprint.startDate || sprint.endDate ? (
            <p className="text-xs text-muted-foreground">
              {sprint.startDate ? format(new Date(sprint.startDate), 'd MMM yyyy') : '—'}
              {' → '}
              {sprint.endDate ? format(new Date(sprint.endDate), 'd MMM yyyy') : '—'}
            </p>
          ) : null}

          {stats ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {stats.completedCount} of {stats.taskCount} tasks
                  {stats.totalPoints > 0
                    ? ` · ${stats.completedPoints}/${stats.totalPoints} points`
                    : ''}
                  {sprint.capacityPoints ? ` · capacity ${sprint.capacityPoints}` : ''}
                </span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => (
          <section key={status} aria-label={STATUS_META[status].label}>
            <header className="mb-2 flex items-center gap-2 px-1">
              <span className={cn('size-2 rounded-full', STATUS_META[status].dot)} aria-hidden="true" />
              <h2 className="text-sm font-medium text-foreground">{STATUS_META[status].label}</h2>
              <span className="text-xs text-muted-foreground">{columns[status].length}</span>
            </header>

            <ul className="space-y-2 rounded-xl bg-muted/30 p-2">
              {columns[status].length === 0 ? (
                <li className="py-6 text-center text-xs text-muted-foreground">Nothing here</li>
              ) : (
                columns[status].slice(0, 50).map((task) => (
                  <li key={task.taskId}>
                    <Link
                      to={`/w/${slug}/projects/${key}/tasks/${task.taskKey}`}
                      className="block rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:ring-ring/40"
                    >
                      <p className="text-sm text-foreground">{task.title}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{task.taskKey}</span>
                        <span className={cn('text-xs', PRIORITY_META[task.priority]?.text)}>
                          {PRIORITY_META[task.priority]?.label}
                        </span>
                        {task.storyPoints != null ? (
                          <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
                            {task.storyPoints}
                          </span>
                        ) : null}
                        {task.assigneeId ? (
                          <span className="ml-auto">
                            <MemberAvatar
                              size="sm"
                              member={{
                                userId: task.assigneeId,
                                fullName: task.assigneeName,
                                avatarUrl: task.assigneeAvatar,
                              }}
                            />
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
