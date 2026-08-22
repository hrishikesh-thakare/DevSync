import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GitCommitHorizontalIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initialsOf } from '@/lib/initials';
import { ISSUE_TYPE_META, PRIORITY_META } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';
import type { TaskSummary } from '@/types/api';

/** The card body, shared by the sortable card and the drag overlay. */
export function TaskCardBody({ task, dragging }: { task: TaskSummary; dragging?: boolean }) {
  const type = ISSUE_TYPE_META[task.issueType];
  const priority = PRIORITY_META[task.priority];

  return (
    <div
      className={cn(
        'rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 transition-colors',
        dragging ? 'shadow-lg' : 'hover:ring-ring/40',
      )}
    >
      <p className="text-sm text-foreground">{task.title}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-xs text-muted-foreground">{task.taskKey}</span>

        <span className="flex items-center gap-1 text-xs text-muted-foreground" title={type?.label}>
          <span aria-hidden="true">{type?.glyph}</span>
          <span className="sr-only">{type?.label}</span>
        </span>

        {priority ? (
          <span className={cn('flex items-center gap-1 text-xs', priority.text)}>
            <span className={cn('size-1.5 rounded-full', priority.dot)} aria-hidden="true" />
            {priority.label}
          </span>
        ) : null}

        {task.storyPoints != null ? (
          <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
            {task.storyPoints}
          </span>
        ) : null}

        {task.linkedCommitsCount > 0 ? (
          <span
            className="flex items-center gap-0.5 text-xs text-muted-foreground"
            title={`${task.linkedCommitsCount} linked commit(s)`}
          >
            <GitCommitHorizontalIcon className="size-3.5" aria-hidden="true" />
            {task.linkedCommitsCount}
          </span>
        ) : null}

        {task.assigneeId ? (
          <Avatar className="ml-auto size-5" title={task.assigneeName ?? undefined}>
            {task.assigneeAvatar ? <AvatarImage src={task.assigneeAvatar} alt="" /> : null}
            <AvatarFallback className="text-[9px]">
              {initialsOf(task.assigneeName ?? '?')}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>
    </div>
  );
}

export function SortableTaskCard({
  task,
  disabled,
  onOpen,
}: {
  task: TaskSummary;
  disabled?: boolean;
  onOpen: (task: TaskSummary) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.taskId,
    data: { type: 'task', task },
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('list-none', isDragging && 'opacity-40')}
    >
      <div
        onClick={() => onOpen(task)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(task);
          }
        }}
        // `attributes` supplies role="button", tabIndex and the drag
        // aria-roledescription; spread it first so nothing here is clobbered.
        {...attributes}
        {...listeners}
        className="cursor-grab rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <TaskCardBody task={task} />
      </div>
    </li>
  );
}
