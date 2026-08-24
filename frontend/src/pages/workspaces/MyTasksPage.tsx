import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDistanceToNow, isPast, isToday, startOfDay } from 'date-fns';
import { LayoutGridIcon, ListIcon, TriangleAlertIcon } from 'lucide-react';

import { apiFetch } from '@/lib/api';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { useTaskDetailStore } from '@/store/taskDetailStore';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
} from '@/components/reui/kanban';
import type { KanbanCommitMeta } from '@/components/reui/kanban';
import { TaskCardBody } from '@/pages/projects/board/TaskCard';
import { KanbanTaskCard } from '@/pages/projects/board/KanbanTaskCard';
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
  const patchTask = useTaskDetailStore((s) => s.patchTask);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [columns, setColumns] = useState<Record<TaskStatus, MyTask[]>>({
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
  });

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

  // The board view needs a live, per-drag-reorderable copy of the grouping —
  // `Kanban`'s `value` is genuinely owned by it during a drag gesture, not
  // just read from. Re-derived from `tasks` on every load/refetch, same as
  // `byStatus` below; a drag's own in-flight reordering lives only in this
  // state until `onValueCommit` either confirms or reverts it.
  useEffect(() => {
    const groups: Record<TaskStatus, MyTask[]> = { todo: [], in_progress: [], in_review: [], done: [] };
    for (const task of tasks) groups[task.status]?.push(task);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to the `tasks` fetch, not derivable from it during render (Kanban owns `columns` mid-drag)
    setColumns(groups);
  }, [tasks]);

  const onBoardCommit = (_value: Record<TaskStatus, MyTask[]>, meta: KanbanCommitMeta<MyTask>) => {
    if (meta.kind !== 'item') return;
    // `Kanban` hands back exactly where a card came from and landed —
    // `activeContainer`/`activeIndex` index straight into `previousValue`,
    // no re-deriving which task moved from the raw drag event.
    const fromStatus = meta.activeContainer as TaskStatus;
    const toStatus = meta.overContainer as TaskStatus;
    // My Tasks has no rank to persist (unlike the project board), so a
    // same-column reorder is a genuine no-op here — nothing to send.
    if (fromStatus === toStatus) return;

    const task = meta.previousValue[fromStatus]?.[meta.activeIndex];
    if (!task) return;
    const taskId = task.taskId;

    void (async () => {
      try {
        await patchTask(workspaceSlug, task.projectKey, task.taskKey, { status: toStatus });
        // Drives the `tasks`-derived effect above, which keeps `columns` (and
        // the list view, if the reader switches back to it) in sync with what
        // just landed on the server.
        setTasks((prev) => prev.map((t) => (t.taskId === taskId ? { ...t, status: toStatus } : t)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not move ${task.taskKey}.`);
        // The write failed, so `tasks` never changed and the effect above
        // never reruns — undo the drag's own optimistic move by hand.
        setColumns((prev) => {
          const reverted: Record<TaskStatus, MyTask[]> = { todo: [], in_progress: [], in_review: [], done: [] };
          for (const status of STATUS_ORDER) {
            reverted[status] = prev[status].filter((t) => t.taskId !== taskId);
          }
          reverted[fromStatus] = [...reverted[fromStatus], task];
          return reverted;
        });
      }
    })();
  };

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

          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view}
            onValueChange={(v) => v && setView(v as 'list' | 'board')}
            className="ml-auto"
          >
            <ToggleGroupItem value="list" aria-label="List view">
              <ListIcon className="size-4" aria-hidden="true" />
            </ToggleGroupItem>
            <ToggleGroupItem value="board" aria-label="Board view">
              <LayoutGridIcon className="size-4" aria-hidden="true" />
            </ToggleGroupItem>
          </ToggleGroup>

          <Button
            variant="outline"
            size="sm"
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
        ) : view === 'board' ? (
          <div className="mt-8">
            <Kanban
              value={columns}
              onValueChange={setColumns}
              onValueCommit={onBoardCommit}
              getItemValue={(t) => t.taskId}
            >
              <KanbanBoard className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {STATUS_ORDER.map((status) => (
                  <KanbanColumn key={status} value={status} className="rounded-xl bg-card p-3">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className={cn('size-2 rounded-full', STATUS_META[status]?.dot)} aria-hidden="true" />
                      {STATUS_META[status]?.label ?? status}
                      <span className="text-muted-foreground">({columns[status].length})</span>
                    </h2>
                    <KanbanColumnContent value={status} className="flex min-h-16 flex-col gap-2">
                      {columns[status].map((task) => (
                        <MyTaskKanbanCard key={task.taskId} task={task} workspaceSlug={workspaceSlug} />
                      ))}
                    </KanbanColumnContent>
                  </KanbanColumn>
                ))}
              </KanbanBoard>
              <KanbanOverlay className="rounded-xl border-2 border-dashed bg-muted/10" />
            </Kanban>
          </div>
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

/**
 * The same `KanbanTaskCard` the project board renders — every kanban in the
 * app is built on that one shell, not `TaskCardBody`'s plain-div one — plus
 * the one thing a *cross-project* board needs that a single project's board
 * does not: which project a card even belongs to. The whole card is its own
 * drag handle, same as the project board; the project-name link stops its
 * own click from bubbling into the handle's, or it would open the task too.
 */
function MyTaskKanbanCard({ task, workspaceSlug }: { task: MyTask; workspaceSlug: string }) {
  const navigate = useNavigate();

  return (
    <KanbanItem value={task.taskId}>
      <KanbanItemHandle
        onClick={() => navigate(`/w/${workspaceSlug}/projects/${task.projectKey}/tasks/${task.taskKey}`)}
        className="block space-y-1.5 rounded-[min(var(--radius-4xl),24px)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Link
          to={`/w/${workspaceSlug}/projects/${task.projectKey}`}
          onClick={(e) => e.stopPropagation()}
          className="block px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:underline"
        >
          {task.projectName} ({task.projectKey})
        </Link>
        <KanbanTaskCard task={task} />
      </KanbanItemHandle>
    </KanbanItem>
  );
}
