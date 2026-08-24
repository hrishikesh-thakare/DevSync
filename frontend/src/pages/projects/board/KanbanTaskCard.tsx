import { format, formatDistanceToNow, isPast } from 'date-fns';
import { CalendarIcon, GitCommitHorizontalIcon } from 'lucide-react';

import { MemberAvatar } from '@/components/MemberAvatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ISSUE_TYPE_META, PRIORITY_META } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';
import type { TaskSummary } from '@/types/api';

/**
 * The card every Kanban board in the app renders — `BoardPage`'s project
 * board and `MyTasksPage`'s board view alike — built on the `Card`/`Badge`
 * shell `@reui/c-kanban-1` actually ships, not `TaskCardBody`'s plain-div
 * one. The priority pill is `Badge`'s own `secondary` variant rather than
 * reui's bordered, saturated `-light` variants — flat, no border, matching
 * every other badge in DevSync (see the `c-kanban-1` example file's own
 * `Badge` swap for the same reasoning).
 *
 * `TaskCardBody` stays as it is for the list-shaped surfaces (My Tasks' list
 * view) that were never a kanban card to begin with.
 */
export function KanbanTaskCard({ task, dragging }: { task: TaskSummary; dragging?: boolean }) {
  const type = ISSUE_TYPE_META[task.issueType];
  const priority = PRIORITY_META[task.priority];

  return (
    <Card className={cn('gap-0 py-0 text-left transition-shadow', dragging ? 'shadow-lg' : 'hover:shadow-md')}>
      <CardContent className="space-y-2.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 min-w-0 text-sm font-medium text-foreground">{task.title}</span>
          {priority ? (
            <Badge variant="secondary" className="h-5 shrink-0 rounded-sm px-1.5 text-xs capitalize">
              {priority.label}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
          <span className="font-mono">{task.taskKey}</span>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center" aria-hidden="true">
                {type?.glyph}
              </span>
            </TooltipTrigger>
            <TooltipContent>{type?.label}</TooltipContent>
          </Tooltip>

          {task.storyPoints != null ? (
            <span className="rounded bg-muted px-1.5">{task.storyPoints}</span>
          ) : null}

          {task.linkedCommitsCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-0.5">
                  <GitCommitHorizontalIcon className="size-3.5" aria-hidden="true" />
                  {task.linkedCommitsCount}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {task.linkedCommitsCount} linked {task.linkedCommitsCount === 1 ? 'commit' : 'commits'}
              </TooltipContent>
            </Tooltip>
          ) : null}

          {task.dueDate ? <DueChip dueDate={task.dueDate} done={task.status === 'done'} /> : null}

          {task.assigneeId ? (
            <span className="ml-auto shrink-0">
              <MemberAvatar
                size="sm"
                member={{ userId: task.assigneeId, fullName: task.assigneeName, avatarUrl: task.assigneeAvatar }}
                showPresence={false}
              />
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
