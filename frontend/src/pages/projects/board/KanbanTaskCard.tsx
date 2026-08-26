import { Link } from 'react-router-dom';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { MemberAvatar } from '@/components/MemberAvatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PRIORITY_META } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';
import type { TaskPriority, TaskSummary } from '@/types/api';

/**
 * Priority chip colour, one per level, using DevSync's own frozen
 * `--priority-*` tokens (`index.css`) rather than reui's semantic
 * destructive/warning/primary palette — that keeps every priority visually
 * distinct instead of collapsing onto a generic red/amber/blue. Solid
 * background + white text, the same "bright chip" pattern reui's own solid
 * badge variants use (`bg-destructive text-white`, etc — `--priority-critical`
 * is in fact nearly identical to `--destructive`) rather than a tinted
 * background with coloured text, which reads as dull on a dark card. `Badge`'s
 * base class already sets `border-transparent`, so no explicit border is
 * needed to get a borderless look.
 */
const PRIORITY_CHIP: Record<TaskPriority, string> = {
  critical: 'bg-priority-critical text-white',
  high: 'bg-priority-high text-white',
  medium: 'bg-priority-medium text-white',
  low: 'bg-priority-low text-white',
};

/**
 * The card every Kanban board in the app renders — `BoardPage`'s project
 * board and `MyTasksPage`'s board view alike — built on the `Card`/`Badge`
 * shell `@reui/c-kanban-1` actually ships, not `TaskCardBody`'s plain-div
 * one.
 *
 * Deliberately minimal: title, priority, assignee, due date. Everything else
 * about a task (key, type, story points, linked commits, description,
 * comments…) lives on the task detail page — a board is for scanning status
 * at a glance, not for reading a task, and every extra chip is something a
 * reader has to visually filter out to find the four things that matter here.
 *
 * `TaskCardBody` stays as it is for the list-shaped surfaces (My Tasks' list
 * view) that were never a kanban card to begin with.
 *
 * `href` turns the title into a real link. The card as a whole is a drag
 * handle, and `KanbanItemHandle` owns `onKeyDown` for dnd-kit's keyboard
 * sensor, so there is no Enter-to-open on the card itself — this link is how
 * a keyboard user opens a task, and it makes middle-click and open-in-new-tab
 * work for everyone else.
 */
export function KanbanTaskCard({
  task,
  dragging,
  href,
}: {
  task: TaskSummary;
  dragging?: boolean;
  href?: string;
}) {
  const priority = PRIORITY_META[task.priority];

  return (
    <Card className={cn('gap-0 py-0 text-left transition-shadow', dragging ? 'shadow-lg' : 'hover:shadow-md')}>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          {href ? (
            <Link
              to={href}
              onClick={(e) => e.stopPropagation()}
              className="line-clamp-2 min-w-0 rounded-sm text-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {task.title}
            </Link>
          ) : (
            <span className="line-clamp-2 min-w-0 text-sm font-medium text-foreground">{task.title}</span>
          )}
          {priority ? (
            <Badge
              variant="secondary"
              className={cn('h-5 shrink-0 rounded-sm px-1.5 text-xs capitalize', PRIORITY_CHIP[task.priority])}
            >
              {priority.label}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.assigneeId ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <MemberAvatar
                size="sm"
                className="shrink-0"
                member={{ userId: task.assigneeId, fullName: task.assigneeName, avatarUrl: task.assigneeAvatar }}
                showPresence={false}
              />
              <span className="truncate">{task.assigneeName}</span>
            </span>
          ) : null}

          {task.dueDate ? (
            <span className="ml-auto shrink-0">
              <DueChip dueDate={task.dueDate} done={task.status === 'done'} />
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DueChip({ dueDate, done }: { dueDate: string; done: boolean }) {
  const due = new Date(dueDate);
  const overdue = !done && isPast(due);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'flex items-center gap-0.5',
            overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="size-3.5" aria-hidden="true" />
          {format(due, 'd MMM')}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {overdue ? 'Overdue — due ' : 'Due '}
        {formatDistanceToNow(due, { addSuffix: true })}
      </TooltipContent>
    </Tooltip>
  );
}
