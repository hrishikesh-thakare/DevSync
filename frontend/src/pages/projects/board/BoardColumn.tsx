import { PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle } from '@/components/reui/kanban';
import { KanbanTaskCard } from '@/pages/projects/board/KanbanTaskCard';
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
  hrefFor,
  selectMode,
  selected,
  onToggleSelect,
}: {
  status: TaskStatus;
  tasks: TaskSummary[];
  canEdit: boolean;
  onCreate: (status: TaskStatus) => void;
  onOpen: (task: TaskSummary) => void;
  hrefFor: (task: TaskSummary) => string;
  /** Bulk-select mode: shows a checkbox per card and suspends dragging so the
   * two interactions (drag a card / select several) don't fight each other. */
  selectMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (taskId: string) => void;
}) {
  const meta = STATUS_META[status];
  const visible = tasks.slice(0, COLUMN_RENDER_CAP);
  const hidden = tasks.length - visible.length;

  // `KanbanColumn` is itself sortable (columns can be dragged past each other)
  // unless something inside it wires up a `KanbanColumnHandle` — nothing here
  // does, on purpose, since a fixed Todo → In Progress → In Review → Done
  // order is part of what a status column means.
  return (
    <KanbanColumn value={status} aria-label={meta.label} className="min-w-0">
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

      <div className="flex-1 rounded-xl bg-muted/30 p-2">
        <KanbanColumnContent value={status} className="min-h-24">
          {visible.map((task) => {
            const card = (
              <KanbanTaskCard
                task={task}
                href={hrefFor(task)}
                selectable={selectMode}
                selected={selected?.has(task.taskId)}
                onToggleSelect={() => onToggleSelect?.(task.taskId)}
              />
            );
            const wrapperClassName =
              'block rounded-[min(var(--radius-4xl),24px)] outline-none focus-visible:ring-2 focus-visible:ring-ring';

            return (
              // `disabled` stays tied to edit permission only — not select
              // mode — because `KanbanItem` dims disabled cards to
              // `opacity-50`, and select mode should look like the normal
              // board, not a greyed-out one.
              <KanbanItem key={task.taskId} value={task.taskId} disabled={!canEdit}>
                {selectMode ? (
                  // No `KanbanItemHandle` here at all: dnd-kit's drag
                  // listeners are only ever attached to what that component
                  // renders (see docs/kanban.md §5), so omitting it — rather
                  // than trying to `disabled`-flag the drag away — is what
                  // actually stops a card from being draggable while
                  // selecting, without the dimmed styling `disabled` implies.
                  <div onClick={() => onOpen(task)} className={wrapperClassName}>
                    {card}
                  </div>
                ) : (
                  // The whole card is its own drag handle — dnd-kit's
                  // distance-based activation (configured on the Kanban
                  // root's sensors) is what lets a stationary click still
                  // open the task instead of starting a drag. Keyboard users
                  // open a task through the title link inside the card, since
                  // the handle owns `onKeyDown` for dnd-kit's keyboard
                  // sensor.
                  <KanbanItemHandle onClick={() => onOpen(task)} className={wrapperClassName}>
                    {card}
                  </KanbanItemHandle>
                )}
              </KanbanItem>
            );
          })}
        </KanbanColumnContent>

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
    </KanbanColumn>
  );
}
