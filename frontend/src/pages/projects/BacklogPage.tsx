import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { GripVerticalIcon, ListTodoIcon, PlusIcon } from 'lucide-react';

import { EmptyState, ErrorState } from '@/components/layout/PageState';
import { MemberAvatar } from '@/components/MemberAvatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateTaskDialog } from '@/pages/projects/board/CreateTaskDialog';
import { useTasksQuery, useMoveTaskMutation, byRank, EMPTY_TASKS } from '@/queries/tasks';
import { useSprintStore } from '@/store/sprintStore';
import { useProjectStore, useMyProjectRole } from '@/store/projectStore';
import { ISSUE_TYPE_META, ISSUE_TYPE_ORDER, PRIORITY_META, PRIORITY_ORDER, STATUS_META } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';
import type { TaskSummary } from '@/types/api';

const ANY = '__any__';

/**
 * The backlog is every task not attached to a sprint, ordered by rank.
 * Reordering uses the same `/reorder` endpoint the board does, keeping status
 * unchanged and only moving the fractional index. It drives dnd-kit directly
 * rather than through the reui Kanban — this is a single sortable list, not a
 * board, and `verticalListSortingStrategy` is the right primitive for it.
 */
export function BacklogPage() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { data: tasks = EMPTY_TASKS, isPending: isLoading, error, refetch } = useTasksQuery(slug, key);
  const { mutateAsync: moveTask } = useMoveTaskMutation(slug, key);
  const { sprints, fetchSprints, addTask } = useSprintStore();
  const members = useProjectStore((s) => s.members);
  const myRole = useMyProjectRole();
  const canEdit = myRole === 'project_admin' || myRole === 'developer';

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignee, setAssignee] = useState(ANY);
  const [priority, setPriority] = useState(ANY);
  const [issueType, setIssueType] = useState(ANY);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (slug && key) void fetchSprints(slug, key);
  }, [slug, key, fetchSprints]);

  const backlog = useMemo(() => tasks.filter((t) => !t.sprintId).sort(byRank), [tasks]);

  const hasFilters = assignee !== ANY || priority !== ANY || issueType !== ANY || search.trim() !== '';

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return backlog.filter(
      (t) =>
        (assignee === ANY || (assignee === 'unassigned' ? !t.assigneeId : t.assigneeId === assignee)) &&
        (priority === ANY || t.priority === priority) &&
        (issueType === ANY || t.issueType === issueType) &&
        (!q || t.title.toLowerCase().includes(q) || t.taskKey.toLowerCase().includes(q)),
    );
  }, [backlog, assignee, priority, issueType, search]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const moving = visible.find((t) => t.taskId === active.id);
    if (!moving) return;

    // Neighbours come from the currently visible (filtered) list, not the
    // full backlog — the drop target the user actually saw and dropped onto.
    const without = visible.filter((t) => t.taskId !== active.id);
    const overIndex = without.findIndex((t) => t.taskId === over.id);
    if (overIndex === -1) return;

    const after = overIndex > 0 ? without[overIndex - 1] : null;
    const before = without[overIndex];

    // Same tied-rank guard as the board: tasks that were never reordered share
    // a default rank, and the server needs a strictly increasing pair. Passing
    // `null` asks it to append after the tied run instead.
    const beforeId = after && before && (after.rank ?? '') >= (before.rank ?? '') ? null : (before?.taskId ?? null);

    try {
      await moveTask({ taskId: moving.taskId, status: moving.status, afterTaskId: after?.taskId ?? null, beforeTaskId: beforeId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reorder.');
    }
  };

  const toggle = (taskId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const assignToSprint = async (sprintId: string) => {
    setAssigning(true);
    const ids = [...selected];
    let ok = 0;
    try {
      for (const taskId of ids) {
        await addTask(slug, key, sprintId, taskId);
        ok += 1;
      }
      toast.success(`${ok} task${ok === 1 ? '' : 's'} added to the sprint`);
      setSelected(new Set());
      await refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? `${err.message} (${ok} of ${ids.length} moved)` : 'Could not assign.',
      );
      await refetch();
    } finally {
      setAssigning(false);
    }
  };

  const openSprints = sprints.filter((s) => s.status !== 'closed');

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Skeleton className="mb-4 h-9 w-64 rounded-lg" />
        <Skeleton className="h-96 w-full rounded-2xl" />
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
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-medium text-foreground">Backlog</h1>
        <span className="text-xs text-muted-foreground">
          {visible.length === backlog.length
            ? `${backlog.length} task${backlog.length === 1 ? '' : 's'} without a sprint`
            : `${visible.length} of ${backlog.length} tasks`}
        </span>

        {canEdit ? (
          <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" aria-hidden="true" />
            Create task
          </Button>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or key"
          aria-label="Search backlog"
          className="w-52"
        />

        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-48" aria-label="Filter by assignee">
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
          <SelectTrigger className="w-40" aria-label="Filter by priority">
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

        <Select value={issueType} onValueChange={setIssueType}>
          <SelectTrigger className="w-40" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All types</SelectItem>
            {ISSUE_TYPE_ORDER.map((t) => (
              <SelectItem key={t} value={t}>
                {ISSUE_TYPE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAssignee(ANY);
              setPriority(ANY);
              setIssueType(ANY);
              setSearch('');
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {selected.size > 0 && canEdit ? (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-foreground">
              {selected.size} selected
            </span>
            <Select disabled={assigning || openSprints.length === 0} onValueChange={(v) => void assignToSprint(v)}>
              <SelectTrigger className="w-64" aria-label="Add selected tasks to sprint">
                <SelectValue
                  placeholder={openSprints.length ? 'Add to sprint…' : 'No open sprint available'}
                />
              </SelectTrigger>
              <SelectContent>
                {openSprints.map((s) => (
                  <SelectItem key={s.sprintId} value={s.sprintId}>
                    {s.name} ({s.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {backlog.length === 0 ? (
        <EmptyState
          icon={<ListTodoIcon aria-hidden="true" />}
          title="Backlog is empty"
          description="Tasks land here until they are added to a sprint."
          action={
            canEdit ? (
              <Button onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-4" aria-hidden="true" />
                Create task
              </Button>
            ) : null
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<ListTodoIcon aria-hidden="true" />}
          title="No tasks match these filters"
          description="Try clearing a filter or searching for something else."
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visible.map((t) => t.taskId)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1">
              {visible.slice(0, 200).map((task) => (
                <BacklogRow
                  key={task.taskId}
                  task={task}
                  canEdit={canEdit}
                  selected={selected.has(task.taskId)}
                  onToggle={() => toggle(task.taskId)}
                  onOpen={() => navigate(`/w/${slug}/projects/${key}/tasks/${task.taskKey}`)}
                />
              ))}
            </ul>
          </SortableContext>
          {visible.length > 200 ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {visible.length - 200} more not shown
            </p>
          ) : null}
        </DndContext>
      )}

      {createOpen ? (
        <CreateTaskDialog
          slug={slug}
          projectKey={key}
          open
          status="todo"
          onOpenChange={(next) => !next && setCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}

function BacklogRow({
  task,
  canEdit,
  selected,
  onToggle,
  onOpen,
}: {
  task: TaskSummary;
  canEdit: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.taskId,
    disabled: !canEdit,
  });

  const priority = PRIORITY_META[task.priority];
  const type = ISSUE_TYPE_META[task.issueType];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/5',
        isDragging && 'opacity-40',
      )}
    >
      {canEdit ? (
        <>
          <button
            type="button"
            className="cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label={`Reorder ${task.taskKey}`}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" aria-hidden="true" />
          </button>
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Select ${task.taskKey}`}
          />
        </>
      ) : null}

      <span className="shrink-0 font-mono text-xs text-muted-foreground">{task.taskKey}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 text-xs text-muted-foreground">
            <span aria-hidden="true">{type?.glyph}</span>
            <span className="sr-only">{type?.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{type?.label}</TooltipContent>
      </Tooltip>

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 truncate text-left text-sm text-foreground hover:underline"
      >
        {task.title}
      </button>

      <Badge variant="outline" className="shrink-0">
        {STATUS_META[task.status].label}
      </Badge>

      <span className={cn('hidden shrink-0 text-xs sm:inline', priority?.text)}>{priority?.label}</span>

      {task.storyPoints != null ? (
        <span className="shrink-0 rounded bg-muted px-1.5 text-xs text-muted-foreground">
          {task.storyPoints}
        </span>
      ) : null}

      {task.assigneeId ? (
        <MemberAvatar
          size="sm"
          className="shrink-0"
          member={{
            userId: task.assigneeId,
            fullName: task.assigneeName,
            avatarUrl: task.assigneeAvatar,
          }}
        />
      ) : null}
    </li>
  );
}
