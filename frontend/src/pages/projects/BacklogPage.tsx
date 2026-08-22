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
import { GripVerticalIcon, PlusIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateTaskDialog } from '@/pages/projects/board/CreateTaskDialog';
import { useTaskStore, byRank } from '@/store/taskStore';
import { useSprintStore } from '@/store/sprintStore';
import { useMyProjectRole } from '@/store/projectStore';
import { ISSUE_TYPE_META, PRIORITY_META, STATUS_META } from '@/lib/taskMeta';
import { initialsOf } from '@/lib/initials';
import { cn } from '@/lib/utils';
import type { TaskSummary } from '@/types/api';

/**
 * The backlog is every task not attached to a sprint, ordered by rank.
 * Reordering uses the same `/reorder` endpoint the board does, keeping status
 * unchanged and only moving the fractional index.
 */
export function BacklogPage() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { tasks, isLoading, error, fetchTasks, moveTask, reset } = useTaskStore();
  const { sprints, fetchSprints, addTask } = useSprintStore();
  const myRole = useMyProjectRole();
  const canEdit = myRole === 'project_admin' || myRole === 'developer';

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (slug && key) {
      void fetchTasks(slug, key);
      void fetchSprints(slug, key);
    }
    return () => reset();
  }, [slug, key, fetchTasks, fetchSprints, reset]);

  const backlog = useMemo(() => tasks.filter((t) => !t.sprintId).sort(byRank), [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const moving = backlog.find((t) => t.taskId === active.id);
    if (!moving) return;

    const without = backlog.filter((t) => t.taskId !== active.id);
    const overIndex = without.findIndex((t) => t.taskId === over.id);
    if (overIndex === -1) return;

    const after = overIndex > 0 ? without[overIndex - 1] : null;
    const before = without[overIndex];

    // Same tied-rank guard as the board: the server's generateKeyBetween throws
    // unless the two neighbouring ranks are strictly increasing.
    const beforeId = after && before && (after.rank ?? '') >= (before.rank ?? '') ? null : (before?.taskId ?? null);

    try {
      await moveTask(slug, key, moving.taskId, moving.status, after?.taskId ?? null, beforeId);
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
      await fetchTasks(slug, key);
    } catch (err) {
      toast.error(
        err instanceof Error ? `${err.message} (${ok} of ${ids.length} moved)` : 'Could not assign.',
      );
      await fetchTasks(slug, key);
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
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-medium text-foreground">Backlog</h1>
        <span className="text-xs text-muted-foreground">
          {backlog.length} task{backlog.length === 1 ? '' : 's'} without a sprint
        </span>

        {canEdit ? (
          <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" aria-hidden="true" />
            Create task
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
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing in the backlog. Tasks appear here until they are added to a sprint.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={backlog.map((t) => t.taskId)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1">
              {backlog.slice(0, 200).map((task) => (
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
          {backlog.length > 200 ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {backlog.length - 200} more not shown
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
      <span className="shrink-0 text-xs text-muted-foreground" title={type?.label}>
        {type?.glyph}
      </span>

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
        <Avatar className="size-6 shrink-0" title={task.assigneeName ?? undefined}>
          {task.assigneeAvatar ? <AvatarImage src={task.assigneeAvatar} alt="" /> : null}
          <AvatarFallback className="text-[9px]">{initialsOf(task.assigneeName ?? '?')}</AvatarFallback>
        </Avatar>
      ) : null}
    </li>
  );
}
