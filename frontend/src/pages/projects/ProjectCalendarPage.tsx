import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarIcon } from 'lucide-react';

import { EmptyState } from '@/components/layout/PageState';
import { EventCalendar } from '@/components/reui/event-calendar/event-calendar';
import { EventCalendarContent } from '@/components/reui/event-calendar/event-calendar-content';
import { EventCalendarNav } from '@/components/reui/event-calendar/event-calendar-nav';
import type {
  CalendarEvent,
  EventCalendarOccurrence,
  EventCalendarProposedUpdate,
} from '@/components/reui/event-calendar/event-calendar-types';
import { useTaskStore } from '@/store/taskStore';
import { useTaskDetailStore } from '@/store/taskDetailStore';
import type { TaskStatus } from '@/types/api';

interface TaskEventData {
  taskKey: string;
}

/** The token each status dot/bg already uses — read as a CSS custom property
 * rather than through the Tailwind `bg-status-*` class the rest of the app
 * uses, since the calendar wants a raw colour value for its `--ec-event-color`
 * var, not a class. */
const STATUS_COLOR_VAR: Record<TaskStatus, string> = {
  todo: 'var(--color-status-todo)',
  in_progress: 'var(--color-status-in-progress)',
  in_review: 'var(--color-status-in-review)',
  done: 'var(--color-status-done)',
};

/**
 * Every task with a due date, on a calendar. `dueDate` has been on the wire
 * since `listTasks`/`getTask` for a while (see `TaskDetailPage`'s own due
 * date picker) but this project never had anywhere that showed the whole
 * project's due dates at once — one task at a time on the detail page, or
 * folded into text on a board/backlog card.
 *
 * Dragging a task to a new day reschedules it for real, through the same
 * `patchTask` the detail page's due date picker uses — this is the same
 * write, just a different picker.
 */
export function ProjectCalendarPage() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { tasks, fetchTasks, applyTaskUpdate, reset } = useTaskStore();
  const patchTask = useTaskDetailStore((s) => s.patchTask);

  useEffect(() => {
    if (slug && key) void fetchTasks(slug, key);
    return () => reset();
  }, [slug, key, fetchTasks, reset]);

  const events = useMemo<CalendarEvent<TaskEventData>[]>(
    () =>
      tasks
        .filter((t) => t.dueDate)
        .map((t) => ({
          id: t.taskId,
          title: `${t.taskKey} ${t.title}`,
          start: new Date(t.dueDate!),
          end: new Date(t.dueDate!),
          allDay: true,
          color: STATUS_COLOR_VAR[t.status],
          data: { taskKey: t.taskKey },
        })),
    [tasks],
  );

  const onEventClick = (occurrence: EventCalendarOccurrence<TaskEventData>) => {
    const taskKey = occurrence.event.data?.taskKey;
    if (taskKey) navigate(`/w/${slug}/projects/${key}/tasks/${taskKey}`);
  };

  // Optimistic: the calendar already moved the chip by the time this returns,
  // so `true` commits that locally while the actual write happens in the
  // background. A failure surfaces as a toast rather than a snap-back — the
  // calendar has no "undo this drag" hook to revert through, and a wrong-but-
  // visible date is easier to notice and re-fix than a silent revert.
  const onEventUpdate = (update: EventCalendarProposedUpdate<TaskEventData>): true | false => {
    const taskKey = update.event.data?.taskKey;
    if (!taskKey) return false;
    const dueDate = update.start.toISOString();
    void (async () => {
      try {
        await patchTask(slug, key, taskKey, { dueDate });
        applyTaskUpdate({ taskId: update.event.id, dueDate });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not reschedule ${taskKey}.`);
      }
    })();
    return true;
  };

  if (events.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <EmptyState
          icon={<CalendarIcon aria-hidden="true" />}
          title="No due dates yet"
          description="Tasks with a due date show up here — set one from a task's detail page, or drag a task to a day once there is one to move."
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <EventCalendar
        defaultEvents={events}
        defaultView="month"
        defaultInteractions={{ drag: true, resize: false, selectSlot: false }}
        onEventClick={onEventClick}
        onEventUpdate={onEventUpdate}
        className="h-[calc(100svh-14rem)] w-full overflow-hidden rounded-xl border"
      >
        <EventCalendarNav className="border-b px-2 py-2" />
        <EventCalendarContent />
      </EventCalendar>
    </div>
  );
}
