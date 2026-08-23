import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow, isPast, isToday, startOfDay } from 'date-fns';
import { TriangleAlertIcon } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { TaskCardBody } from '@/pages/projects/board/TaskCard';
import { STATUS_META, STATUS_ORDER } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';
import type { TaskStatus, TaskSummary } from '@/types/api';

interface MyTask extends TaskSummary {
  projectId: string;
  projectName: string;
  projectKey: string;
}

/** Past its due date, and not already finished. */
function isOverdue(task: MyTask): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  const due = new Date(task.dueDate);
  return isPast(startOfDay(due)) && !isToday(due);
}

export function MyTasksPage() {
  const { slug: workspaceSlug } = useCurrentWorkspaceStore();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (includeDone: boolean) => {
      setIsLoading(true);
      setError(null);
      try {
        // `open` is the endpoint default; `all` is what the Done toggle asks for.
        const data = await apiFetch(
          `/workspaces/${workspaceSlug}/my-tasks?status=${includeDone ? 'all' : 'open'}`,
        );
        setTasks(data.tasks ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
        setTasks([]);
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceSlug],
  );

  useEffect(() => {
    if (!workspaceSlug) return;
    // Refetching when the workspace or the Done filter changes is the
    // "synchronise with an external system" case the lint rule permits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(showDone);
  }, [workspaceSlug, showDone, load]);

  const overdue = useMemo(() => tasks.filter(isOverdue), [tasks]);

  const byStatus = useMemo(() => {
    const groups = new Map<TaskStatus, MyTask[]>();
    for (const status of STATUS_ORDER) groups.set(status, []);
    for (const task of tasks) {
      groups.get(task.status)?.push(task);
    }
    return STATUS_ORDER.map((status) => ({ status, items: groups.get(status) ?? [] })).filter(
      (group) => group.items.length > 0,
    );
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl p-6">
        <PageHeader title="My Tasks" description="Loading tasks assigned to you…" />
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Empty className="min-h-[60svh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Failed to load tasks</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // No `overflow-auto` of its own: `WorkspaceLayout`'s `<main>` now scrolls
  // the whole page via a `ScrollArea`, and this page has no fixed header of
  // its own that would need a second, independent scroll region.
  return (
    <div className="bg-muted/20">
      <div className="mx-auto w-full max-w-7xl p-6">
        <PageHeader
          title="My Tasks"
          description="Everything assigned to you across every project in this workspace."
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {overdue.length > 0 ? (
            <Badge variant="destructive" className="gap-1.5">
              <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
              {overdue.length} overdue
            </Badge>
          ) : null}
          <span className="text-sm text-muted-foreground">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            aria-pressed={showDone}
            onClick={() => setShowDone((v) => !v)}
          >
            {showDone ? 'Hide done' : 'Show done'}
          </Button>
        </div>

        {tasks.length === 0 ? (
          <Empty className="mt-12 rounded-2xl border bg-background shadow-sm">
            <EmptyHeader>
              <EmptyTitle>You&rsquo;re all caught up</EmptyTitle>
              <EmptyDescription>
                Nothing is assigned to you right now.
                {showDone ? '' : ' Completed work is hidden — use Show done to see it.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mt-8 space-y-8">
            {byStatus.map(({ status, items }) => (
              <section key={status}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <span
                    className={cn('size-2 rounded-full', STATUS_META[status]?.dot)}
                    aria-hidden="true"
                  />
                  {STATUS_META[status]?.label ?? status}
                  <span className="text-muted-foreground">({items.length})</span>
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((task) => (
                    <MyTaskCard key={task.taskId} task={task} workspaceSlug={workspaceSlug} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MyTaskCard({ task, workspaceSlug }: { task: MyTask; workspaceSlug: string }) {
  const overdue = isOverdue(task);

  return (
    <div className="flex flex-col gap-1.5">
      <Link
        to={`/w/${workspaceSlug}/projects/${task.projectKey}`}
        className="text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:underline"
      >
        {task.projectName} ({task.projectKey})
      </Link>

      <Link
        to={`/w/${workspaceSlug}/projects/${task.projectKey}/tasks/${task.taskKey}`}
        className={cn(
          'rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring',
          overdue && 'ring-1 ring-destructive/50',
        )}
      >
        <TaskCardBody task={task} />
      </Link>

      {task.dueDate ? (
        <p
          className={cn(
            'text-xs',
            overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          {overdue ? 'Overdue — due ' : 'Due '}
          {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
        </p>
      ) : null}
    </div>
  );
}
