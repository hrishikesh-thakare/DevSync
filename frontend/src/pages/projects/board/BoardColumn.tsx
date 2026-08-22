import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SortableTaskCard } from '@/pages/projects/board/TaskCard';
import { STATUS_META } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';
import type { TaskStatus, TaskSummary } from '@/types/api';

/**
 * Cards rendered per column. A board is meant to be scannable, and a column
 * with four figures of cards in it stops being a board and starts being a
 * performance problem — the rest stay reachable through the backlog.
 */
const COLUMN_RENDER_CAP = 100;

export function BoardColumn({
  status,
  tasks,
  canEdit,
  onCreate,
  onOpen,
}: {
  status: TaskStatus;
  tasks: TaskSummary[];
  canEdit: boolean;
  onCreate: (status: TaskStatus) => void;
  onOpen: (task: TaskSummary) => void;
}) {
  const meta = STATUS_META[status];
  const visible = tasks.slice(0, COLUMN_RENDER_CAP);
  const hidden = tasks.length - visible.length;

  // The column itself is a drop target so an empty column can still receive a
  // card — SortableContext alone only registers the cards inside it.
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}`, data: { type: 'column', status } });

  return (
    <section className="flex min-w-0 flex-col" aria-label={meta.label}>
      <header className="mb-2 flex items-center gap-2 px-1">
        <span className={cn('size-2 rounded-full', meta.dot)} aria-hidden="true" />
        <h2 className="text-sm font-medium text-foreground">{meta.label}</h2>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
        {canEdit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            onClick={() => onCreate(status)}
            aria-label={`Create task in ${meta.label}`}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 transition-colors',
          isOver ? 'bg-accent/60 ring-1 ring-ring/40' : 'bg-muted/30',
        )}
      >
        <SortableContext items={visible.map((t) => t.taskId)} strategy={verticalListSortingStrategy}>
          <ul className="flex min-h-24 flex-col gap-2">
            {visible.map((task) => (
              <SortableTaskCard key={task.taskId} task={task} disabled={!canEdit} onOpen={onOpen} />
            ))}
          </ul>
        </SortableContext>

        {tasks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {canEdit ? 'Drop a card here' : 'Nothing here'}
          </p>
        ) : null}

        {hidden > 0 ? (
          <p className="px-1 pt-3 text-center text-xs text-muted-foreground">
            {hidden} more not shown
          </p>
        ) : null}
      </div>
    </section>
  );
}
