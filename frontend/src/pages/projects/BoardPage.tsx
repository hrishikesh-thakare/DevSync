import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
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
import { BoardColumn } from '@/pages/projects/board/BoardColumn';
import { TaskCardBody } from '@/pages/projects/board/TaskCard';
import { CreateTaskDialog } from '@/pages/projects/board/CreateTaskDialog';
import { useTaskStore, byRank } from '@/store/taskStore';
import { useProjectStore, useMyProjectRole } from '@/store/projectStore';
import { PRIORITY_META, PRIORITY_ORDER, STATUS_ORDER } from '@/lib/taskMeta';
import type { TaskStatus, TaskSummary } from '@/types/api';
import { socketClient } from '@/lib/socket';

const ANY = '__any__';

export function BoardPage() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { tasks, isLoading, error, fetchTasks, moveTask, applyTaskUpdate, reset } = useTaskStore();
  const project = useProjectStore((s) => s.project);
  const members = useProjectStore((s) => s.members);
  const myRole = useMyProjectRole();
  const canEdit = myRole === 'project_admin' || myRole === 'developer';

  const [assignee, setAssignee] = useState(ANY);
  const [priority, setPriority] = useState(ANY);
  const [dragging, setDragging] = useState<TaskSummary | null>(null);
  const [createIn, setCreateIn] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (slug && key) void fetchTasks(slug, key);
    return () => reset();
  }, [slug, key, fetchTasks, reset]);

  useEffect(() => {
    if (!project?.projectId) return;

    const socket = socketClient.getSocket();
    if (!socket) return;

    const room = `project:${project.projectId}`;
    socket.emit('join_room', room);

    const onTaskUpdated = (task: Partial<TaskSummary> & { taskId: string }) => {
      applyTaskUpdate(task);
    };

    socket.on('task_updated', onTaskUpdated);

    return () => {
      socket.off('task_updated', onTaskUpdated);
      socket.emit('leave_room', room);
    };
  }, [project?.projectId, applyTaskUpdate]);

  const sensors = useSensors(
    // A small distance threshold keeps a click-to-open from registering as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const columns = useMemo(() => {
    const map: Record<TaskStatus, TaskSummary[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };
    for (const task of filtered) map[task.status]?.push(task);
    for (const status of STATUS_ORDER) map[status].sort(byRank);
    return map;
  }, [filtered]);

  const onDragStart = (e: DragStartEvent) => {
    setDragging((e.active.data.current as { task?: TaskSummary } | undefined)?.task ?? null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;

    const task = (active.data.current as { task?: TaskSummary } | undefined)?.task;
    if (!task) return;

    // The drop target is either a column (empty space) or another card.
    const overData = over.data.current as
      | { type?: string; status?: TaskStatus; task?: TaskSummary }
      | undefined;

    const targetStatus: TaskStatus | undefined =
      overData?.type === 'column' ? overData.status : overData?.task?.status;
    if (!targetStatus) return;

    // Recompute the destination column without the dragged card, so the
    // neighbours sent to the server describe where it is landing.
    const destination = columns[targetStatus].filter((t) => t.taskId !== task.taskId);

    let index = destination.length;
    if (overData?.type === 'task' && overData.task) {
      const overIndex = destination.findIndex((t) => t.taskId === overData.task!.taskId);
      if (overIndex !== -1) index = overIndex;
    }

    const after = index > 0 ? destination[index - 1] : null;
    const before = index < destination.length ? destination[index] : null;

    const afterTaskId = after?.taskId ?? null;
    let beforeTaskId = before?.taskId ?? null;

    // The server derives the new rank with `generateKeyBetween(afterRank,
    // beforeRank)`, which throws unless afterRank is strictly less than
    // beforeRank — and that 500s the request. Tasks created but never reordered
    // all share the same default rank, so equal neighbours are common. Drop one
    // side in that case: the card still lands in the right column, just at the
    // end of the tied run instead of between two identical keys.
    if (after && before && (after.rank ?? '') >= (before.rank ?? '')) {
      beforeTaskId = null;
    }

    if (task.status === targetStatus && afterTaskId === null && beforeTaskId === null) return;

    try {
      await moveTask(slug, key, task.taskId, targetStatus, afterTaskId, beforeTaskId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not move the task.');
    }
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tasks={columns[status]}
              canEdit={canEdit}
              onCreate={setCreateIn}
              onOpen={(task) => navigate(`/w/${slug}/projects/${key}/tasks/${task.taskKey}`)}
            />
          ))}
        </div>

        <DragOverlay>{dragging ? <TaskCardBody task={dragging} dragging /> : null}</DragOverlay>
      </DndContext>

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
