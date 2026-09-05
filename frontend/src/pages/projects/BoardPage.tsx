import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ListChecksIcon, PlusIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BoardSkeleton, ErrorState } from '@/components/layout/PageState';
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
import { useTasksQuery, useMoveTaskMutation, useBulkUpdateTasksMutation, byRank, getTaskId, EMPTY_TASKS } from '@/queries/tasks';
import { useProjectStore, useMyProjectRole } from '@/store/projectStore';
import { useLabelStore } from '@/store/labelStore';
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER } from '@/lib/taskMeta';
import type { TaskStatus, TaskSummary } from '@/types/api';

const ANY = '__any__';
const UNASSIGN = '__unassign__';

const EMPTY_COLUMNS: Record<TaskStatus, TaskSummary[]> = {
  todo: [],
  in_progress: [],
  in_review: [],
  done: [],
};

export function BoardPage() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { data: tasks = EMPTY_TASKS, isPending: isLoading, error } = useTasksQuery(slug, key);
  const { mutate: moveTask } = useMoveTaskMutation(slug, key);
  const { mutateAsync: bulkUpdate } = useBulkUpdateTasksMutation(slug, key);
  const members = useProjectStore((s) => s.members);
  const { labels, fetchLabels } = useLabelStore();
  const myRole = useMyProjectRole();
  const canEdit = myRole === 'project_admin' || myRole === 'developer';

  const [assignee, setAssignee] = useState(ANY);
  const [priority, setPriority] = useState(ANY);
  const [createIn, setCreateIn] = useState<TaskStatus | null>(null);

  // Bulk select — a separate mode from filtering, so the same checkbox click
  // never also has to fight the drag sensor for the same gesture (see
  // `BoardColumn`, which disables dragging for the duration).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (slug && key) void fetchLabels(slug, key);
  }, [slug, key, fetchLabels]);

  const toggleSelect = (taskId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const runBulk = async (successVerb: string, patch: (t: TaskSummary) => Record<string, unknown>) => {
    const selectedTasks = tasks.filter((t) => selected.has(t.taskId));
    if (selectedTasks.length === 0) return;
    const { ok, failed, total } = await bulkUpdate({ tasks: selectedTasks, patch });
    if (failed === 0) toast.success(`${successVerb} ${ok} task${ok === 1 ? '' : 's'}`);
    else toast.error(`${successVerb}: only ${ok} of ${total} succeeded`);
    setSelected(new Set());
  };

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
  // task list changes. `useMoveTaskMutation` reverts the query cache itself on
  // a failed request (see `queries/tasks.ts`), which flows back through
  // `filtered` and resyncs this without any extra revert logic here.
  const [columns, setColumns] = useState<Record<TaskStatus, TaskSummary[]>>(EMPTY_COLUMNS);

  useEffect(() => {
    const map: Record<TaskStatus, TaskSummary[]> = { todo: [], in_progress: [], in_review: [], done: [] };
    for (const task of filtered) map[task.status]?.push(task);
    for (const status of STATUS_ORDER) map[status].sort(byRank);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to the filtered `tasks` fetch, not derivable from it during render (Kanban owns `columns` mid-drag)
    setColumns(map);
  }, [filtered]);

  // `useCallback`, not a plain function: the vendored `Kanban` puts
  // `onValueCommit` in the dependency array of several of its *own* internal
  // `useCallback`s (`commitChange`, `handleDragStart`, `handleDragOver`,
  // `handleDragEnd` — see `components/reui/kanban.tsx`). A fresh function
  // identity here on every `BoardPage` render defeats all of those the same
  // way an unmemoized `getItemValue` did (see `queries/tasks.ts`'s
  // `getTaskId`) — and since `handleDragOver` itself calls `setColumns` on
  // every pointer move mid-drag, an unstable `onValueCommit` turns "BoardPage
  // re-rendered" into "dnd-kit's internal handlers were rebuilt", which drives
  // exactly the kind of render-measure-render cascade `getTaskId` alone did
  // not fully close off on a large column.
  const onBoardCommit = useCallback(
    (value: Record<TaskStatus, TaskSummary[]>, meta: KanbanCommitMeta<TaskSummary>) => {
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

      moveTask(
        { taskId: task.taskId, status: targetStatus, afterTaskId, beforeTaskId },
        { onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not move the task.') },
      );
    },
    [moveTask],
  );

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <BoardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <ErrorState message={error instanceof Error ? error.message : 'Could not load tasks.'} />
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
          <Button
            variant={selectMode ? 'secondary' : 'outline'}
            size="sm"
            className={canEdit ? undefined : 'ml-auto'}
            onClick={() => {
              setSelectMode((v) => !v);
              setSelected(new Set());
            }}
          >
            <ListChecksIcon className="size-4" aria-hidden="true" />
            {selectMode ? 'Done selecting' : 'Select'}
          </Button>
        ) : null}

        {canEdit ? (
          <Button className="ml-auto" onClick={() => setCreateIn('todo')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            Create task
          </Button>
        ) : null}
      </div>

      {selectMode && selected.size > 0 ? (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-foreground">{selected.size} selected</span>

            <Select onValueChange={(v) => void runBulk('Assigned', () => ({ assigneeId: v === UNASSIGN ? null : v }))}>
              <SelectTrigger className="w-48" aria-label="Bulk assign">
                <SelectValue placeholder="Assign to…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGN}>Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.displayName || m.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              disabled={labels.length === 0}
              onValueChange={(v) =>
                void runBulk('Labelled', (t) => ({ labels: Array.from(new Set([...(t.labels ?? []), v])) }))
              }
            >
              <SelectTrigger className="w-48" aria-label="Bulk add label">
                <SelectValue placeholder={labels.length ? 'Add label…' : 'No labels yet'} />
              </SelectTrigger>
              <SelectContent>
                {labels.map((l) => (
                  <SelectItem key={l.labelId} value={l.name}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={(v) => void runBulk('Moved', () => ({ status: v as TaskStatus }))}>
              <SelectTrigger className="w-44" aria-label="Bulk move status">
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
              <XIcon className="size-4" aria-hidden="true" />
              Clear selection
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Kanban value={columns} onValueChange={setColumns} onValueCommit={onBoardCommit} getItemValue={getTaskId}>
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
              selectMode={selectMode}
              selected={selected}
              onToggleSelect={toggleSelect}
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
