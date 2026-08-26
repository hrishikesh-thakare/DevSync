import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PlusIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Kanban, KanbanBoard, KanbanOverlay, type KanbanCommitMeta } from '@/components/reui/kanban';
import { BoardColumn } from '@/pages/projects/board/BoardColumn';
import { KanbanTaskCard } from '@/pages/projects/board/KanbanTaskCard';
import { CreateTaskDialog } from '@/pages/projects/board/CreateTaskDialog';
import { useTaskStore, byRank } from '@/store/taskStore';
import { useProjectStore, useMyProjectRole } from '@/store/projectStore';
import { PRIORITY_META, PRIORITY_ORDER, STATUS_ORDER } from '@/lib/taskMeta';
import type { TaskStatus, TaskSummary } from '@/types/api';

const ANY = '__any__';

const EMPTY_COLUMNS: Record<TaskStatus, TaskSummary[]> = {
  todo: [],
  in_progress: [],
  in_review: [],
  done: [],
};

export function BoardPage() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { tasks, isLoading, error, fetchTasks, moveTask, reset } = useTaskStore();
  const members = useProjectStore((s) => s.members);
  const myRole = useMyProjectRole();
  const canEdit = myRole === 'project_admin' || myRole === 'developer';

  const [assignee, setAssignee] = useState(ANY);
  const [priority, setPriority] = useState(ANY);
  const [createIn, setCreateIn] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (slug && key) void fetchTasks(slug, key);
    return () => reset();
  }, [slug, key, fetchTasks, reset]);

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (assignee === ANY ||
            (assignee === 'unassigned' ? !t.assigneeId : t.assigneeId === assignee)) &&
          (priority === ANY || t.priority === priority),
      ),
    [tasks, assignee, priority],
  );

  // `Kanban`'s `value` is genuinely owned by it during a drag gesture — this
  // is the live, per-drag-reorderable copy, re-derived whenever the filtered
  // task list changes. `moveTask` reverts `tasks` itself on a failed request
  // (see `taskStore.ts`), which flows back through `filtered` and resyncs
  // this without any extra revert logic here.
  const [columns, setColumns] = useState<Record<TaskStatus, TaskSummary[]>>(EMPTY_COLUMNS);

  useEffect(() => {
    const map: Record<TaskStatus, TaskSummary[]> = { todo: [], in_progress: [], in_review: [], done: [] };
    for (const task of filtered) map[task.status]?.push(task);
    for (const status of STATUS_ORDER) map[status].sort(byRank);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to the filtered `tasks` fetch, not derivable from it during render (Kanban owns `columns` mid-drag)
    setColumns(map);
  }, [filtered]);

  const onBoardCommit = (value: Record<TaskStatus, TaskSummary[]>, meta: KanbanCommitMeta<TaskSummary>) => {
    if (meta.kind !== 'item') return;

    // `Kanban` only ever calls `onValueCommit` once a card genuinely landed
    // somewhere new (it checks that itself before firing), and it already
    // hands back exactly where: `overContainer`/`overIndex` in `value`, the
    // array it just finished reordering. Nothing here re-derives either.
    const targetStatus = meta.overContainer as TaskStatus;
    const destination = value[targetStatus] ?? [];
    const task = destination[meta.overIndex];
    if (!task) return;

    const after = meta.overIndex > 0 ? destination[meta.overIndex - 1] : null;
    const before = meta.overIndex < destination.length - 1 ? destination[meta.overIndex + 1] : null;

    const afterTaskId = after?.taskId ?? null;
    let beforeTaskId = before?.taskId ?? null;

    // The server derives the new rank with `generateKeyBetween(afterRank,
    // beforeRank)`, which needs afterRank strictly less than beforeRank. Tasks
    // created but never reordered all share the same default rank, so equal
    // neighbours are common. Dropping one side asks for "append after the tied
    // run", which is the same thing the server falls back to — sending it
    // explicitly keeps the optimistic rank and the persisted one identical.
    if (after && before && (after.rank ?? '') >= (before.rank ?? '')) {
      beforeTaskId = null;
    }

    void moveTask(slug, key, task.taskId, targetStatus, afterTaskId, beforeTaskId).catch((err) => {
      toast.error(err instanceof Error ? err.message : 'Could not move the task.');
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Skeleton className="mb-4 h-9 w-72 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-52" aria-label="Filter by assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.displayName || m.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-44" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All priorities</SelectItem>
            {PRIORITY_ORDER.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_META[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {assignee !== ANY || priority !== ANY ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAssignee(ANY);
              setPriority(ANY);
            }}
          >
            Clear filters
          </Button>
        ) : null}

        <span className="text-xs text-muted-foreground">
          {filtered.length === tasks.length
            ? `${tasks.length} tasks`
            : `${filtered.length} of ${tasks.length} tasks`}
        </span>

        {canEdit ? (
          <Button className="ml-auto" onClick={() => setCreateIn('todo')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            Create task
          </Button>
        ) : null}
      </div>

      <Kanban value={columns} onValueChange={setColumns} onValueCommit={onBoardCommit} getItemValue={(t) => t.taskId}>
        <KanbanBoard className="flex-1 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tasks={columns[status]}
              canEdit={canEdit}
              onCreate={setCreateIn}
              onOpen={(task) => navigate(`/w/${slug}/projects/${key}/tasks/${task.taskKey}`)}
              hrefFor={(task) => `/w/${slug}/projects/${key}/tasks/${task.taskKey}`}
            />
          ))}
        </KanbanBoard>

        <KanbanOverlay>
          {({ value }) => {
            const task = tasks.find((t) => t.taskId === value);
            return task ? <KanbanTaskCard task={task} dragging /> : null;
          }}
        </KanbanOverlay>
      </Kanban>

      {/* Mounted only while open so each run starts from fresh defaults,
          rather than resetting state from an effect. */}
      {createIn !== null ? (
        <CreateTaskDialog
          slug={slug}
          projectKey={key}
          open
          status={createIn}
          onOpenChange={(next) => !next && setCreateIn(null)}
        />
      ) : null}
    </div>
  );
}
