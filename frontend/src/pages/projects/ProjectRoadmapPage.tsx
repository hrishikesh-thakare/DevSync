import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarRangeIcon } from 'lucide-react';

import { EmptyState } from '@/components/layout/PageState';
import { Gantt } from '@/components/reui/gantt/gantt';
import { GanttNav } from '@/components/reui/gantt/gantt-nav';
import { GanttView } from '@/components/reui/gantt/gantt-view';
import type { GanttEvent, GanttOccurrence, GanttResource } from '@/components/reui/gantt/gantt-types';
import { useSprintStore } from '@/store/sprintStore';
import type { Sprint } from '@/types/api';

interface SprintBarData {
  sprintId: string;
}

const STATUS_COLOR: Record<Sprint['status'], string> = {
  future: 'var(--color-slate-400)',
  active: 'var(--color-blue-500)',
  closed: 'var(--color-emerald-500)',
};

function progressOf(sprint: Sprint): number | undefined {
  const stats = sprint.stats;
  if (!stats) return undefined;
  if (stats.totalPoints > 0) return Math.round((stats.completedPoints / stats.totalPoints) * 100);
  if (stats.taskCount > 0) return Math.round((stats.completedCount / stats.taskCount) * 100);
  return 0;
}

/**
 * Every sprint that has both a start and end date, as a timeline. The list
 * page (`SprintListPage`) already shows the same dates and the same percent-
 * complete, one card at a time — this is the same data laid out so "what's
 * running when, and what overlaps" reads at a glance instead of requiring you
 * to hold three cards' date ranges in your head.
 *
 * Read-only: dragging a sprint's bar would mean silently rewriting its start
 * or end date outside the sprint-lifecycle rules (`startSprint`/`closeSprint`
 * are the only state transitions the backend allows), so drag/resize are off.
 */
export function ProjectRoadmapPage() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { sprints, fetchSprints } = useSprintStore();

  useEffect(() => {
    if (slug && key) void fetchSprints(slug, key);
  }, [slug, key, fetchSprints]);

  const scheduled = useMemo(() => sprints.filter((s) => s.startDate && s.endDate), [sprints]);

  const resources = useMemo<GanttResource[]>(
    () => scheduled.map((s) => ({ id: s.sprintId, title: s.name })),
    [scheduled],
  );

  const events = useMemo<GanttEvent<SprintBarData>[]>(
    () =>
      scheduled.map((s) => ({
        id: s.sprintId,
        title: s.name,
        start: new Date(s.startDate!),
        end: new Date(s.endDate!),
        allDay: true,
        color: STATUS_COLOR[s.status],
        progress: progressOf(s),
        resourceId: s.sprintId,
        readOnly: true,
        data: { sprintId: s.sprintId },
      })),
    [scheduled],
  );

  const onEventClick = (occurrence: GanttOccurrence<SprintBarData>) => {
    const sprintId = occurrence.event.data?.sprintId;
    if (sprintId) navigate(`/w/${slug}/projects/${key}/sprints/${sprintId}`);
  };

  if (scheduled.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <EmptyState
          icon={<CalendarRangeIcon aria-hidden="true" />}
          title="Nothing to schedule yet"
          description="Sprints need both a start and end date to appear on the roadmap — set them when you create a sprint."
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Gantt
        defaultEvents={events}
        resources={resources}
        defaultScale="week"
        defaultInteractions={{ drag: false, resize: false, selectSlot: false }}
        onEventClick={onEventClick}
        treePanel={{ width: 220 }}
        className="h-[calc(100svh-14rem)] w-full overflow-hidden rounded-xl border"
      >
        <GanttNav className="border-b px-2 py-2" />
        <GanttView />
      </Gantt>
    </div>
  );
}
