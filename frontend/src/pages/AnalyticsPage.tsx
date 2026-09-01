import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, ErrorState } from '@/components/layout/PageState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { apiFetch } from '@/lib/api';
import { STATUS_META } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/types/api';

interface CycleTimeEntry {
  status: TaskStatus;
  avgHours: number | null;
  medianHours: number | null;
  sampleSize: number;
}

interface Analytics {
  role: string;
  window: { from: string; to: string };
  projects: { projectId: string; key: string; name: string }[];
  cycleTime: CycleTimeEntry[];
  throughput: { week: string; completed: number }[];
  velocity: {
    sprintId: string;
    name: string;
    completedPoints: number;
    completedCount: number;
  }[];
  contribution: {
    userId: string;
    fullName: string;
    tasksCompleted: number;
    commits: number;
    prsMerged: number;
  }[];
  ciTrend: {
    day: string;
    total: number;
    succeeded: number;
    successRate: number;
    avgDurationSeconds: number | null;
  }[];
  burndown: {
    sprintId: string;
    name: string;
    totalPoints: number;
    series: { date: string; remaining: number; ideal: number }[];
    note: string | null;
  }[];
}

const RANGES = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '6m', days: 180 },
];

/** Hours read badly at both extremes — sub-hour work and multi-day waits. */
function formatDuration(hours: number | null): string {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

const axisProps = {
  stroke: 'var(--color-muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export function AnalyticsPage() {
  const { slug = '', key: projectKey } = useParams();
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Analytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const from = new Date();
      from.setDate(from.getDate() - days);
      const scope = projectKey ? `&projectKey=${encodeURIComponent(projectKey)}` : '';
      setData(
        await apiFetch(
          `/workspaces/${slug}/analytics?from=${from.toISOString()}${scope}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [slug, projectKey, days]);

  useEffect(() => {
    if (!slug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [slug, load]);

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Analytics" description="Loading team and delivery metrics…" />
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Analytics"
        description={
          projectKey
            ? `Delivery metrics for ${projectKey}.`
            : 'Delivery metrics across every project you can see in this workspace.'
        }
        actions={
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <Button
                key={r.days}
                size="sm"
                variant={days === r.days ? 'default' : 'outline'}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      />

      {error ? (
        <ErrorState message={error} className="mb-6" />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <CycleTimeCard entries={data?.cycleTime ?? []} />
        <ThroughputCard points={data?.throughput ?? []} />
        <VelocityCard sprints={data?.velocity ?? []} />
        <ContributionCard members={data?.contribution ?? []} />
        <CiTrendCard days={data?.ciTrend ?? []} />
      </div>

      {(data?.burndown ?? []).map((sprint) => (
        <BurndownCard key={sprint.sprintId} sprint={sprint} />
      ))}

      <p className="mt-8 text-xs text-muted-foreground">
        These are value-stream metrics — how work moves through the board. They are not DORA
        metrics, which measure deployments and production incidents; DevSync does not track
        deployments, so those cannot be derived honestly here.
      </p>
    </PageShell>
  );
}

/** Card shell that renders an honest empty state instead of an axis with no data. */
function ChartCard({
  title,
  subtitle,
  isEmpty,
  emptyText,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  isEmpty: boolean;
  emptyText: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          // Height-matched to the chart it stands in for, so a card that has
          // no data yet does not collapse and shift the ones beside it.
          <div className="flex h-56 items-center justify-center">
            <EmptyState compact title="Nothing to chart yet" description={emptyText} />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function CycleTimeCard({ entries }: { entries: CycleTimeEntry[] }) {
  const rows = entries.map((e) => ({
    status: STATUS_META[e.status]?.label ?? e.status,
    key: e.status,
    hours: e.avgHours ?? 0,
    median: e.medianHours ?? 0,
    sampleSize: e.sampleSize,
    fill: `var(--color-status-${e.status.replace(/_/g, '-')})`,
  }));

  const config: ChartConfig = { hours: { label: 'Avg time' } };

  return (
    <ChartCard
      title="Cycle time"
      subtitle="Average time a task spends in each column before moving on."
      isEmpty={rows.every((r) => r.sampleSize === 0)}
      emptyText="No completed transitions in this window yet. Move a task across the board and it will appear here."
    >
      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" {...axisProps} />
          <YAxis type="category" dataKey="status" width={92} {...axisProps} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => (
                  <span>
                    {formatDuration(Number(value))} avg ·{' '}
                    {formatDuration(Number(item?.payload?.median))} median ·{' '}
                    {item?.payload?.sampleSize} samples
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="hours" radius={4} />
        </BarChart>
      </ChartContainer>
      <ul className="mt-4 space-y-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-xs">
            <span className={cn('size-2 rounded-full', STATUS_META[r.key as TaskStatus]?.dot)} />
            <span className="text-muted-foreground">{r.status}</span>
            <span className="ml-auto tabular-nums text-foreground">{formatDuration(r.hours)}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function ThroughputCard({ points }: { points: { week: string; completed: number }[] }) {
  const rows = points.map((p) => ({
    week: format(new Date(p.week), 'd MMM'),
    completed: p.completed,
  }));

  const config: ChartConfig = {
    completed: { label: 'Completed', color: 'var(--color-status-done)' },
  };

  return (
    <ChartCard
      title="Throughput"
      subtitle="Tasks finished per week."
      isEmpty={rows.length === 0}
      emptyText="Nothing has been completed in this window."
    >
      <ChartContainer config={config} className="h-56 w-full">
        <AreaChart data={rows} margin={{ left: 4, right: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="week" {...axisProps} />
          <YAxis allowDecimals={false} width={32} {...axisProps} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            dataKey="completed"
            type="monotone"
            stroke="var(--color-completed)"
            fill="var(--color-completed)"
            fillOpacity={0.18}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  );
}

function VelocityCard({
  sprints,
}: {
  sprints: { sprintId: string; name: string; completedPoints: number; completedCount: number }[];
}) {
  const rows = sprints.map((s) => ({
    name: s.name,
    points: s.completedPoints,
    tasks: s.completedCount,
  }));

  const config: ChartConfig = {
    points: { label: 'Points shipped', color: 'var(--color-primary)' },
  };

  return (
    <ChartCard
      title="Velocity"
      subtitle="Story points actually shipped per closed sprint."
      isEmpty={rows.length === 0}
      emptyText="No sprints have been closed yet."
    >
      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={rows} margin={{ left: 4, right: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis allowDecimals={false} width={32} {...axisProps} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="points" fill="var(--color-points)" radius={4} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function ContributionCard({
  members,
}: {
  members: {
    userId: string;
    fullName: string;
    tasksCompleted: number;
    commits: number;
    prsMerged: number;
  }[];
}) {
  const rows = members.slice(0, 8).map((m) => ({
    // Charts get unreadable fast with full names on a vertical axis.
    name: m.fullName.split(' ')[0],
    tasks: m.tasksCompleted,
    commits: m.commits,
    prs: m.prsMerged,
  }));

  const config: ChartConfig = {
    tasks: { label: 'Tasks done', color: 'var(--color-status-done)' },
    commits: { label: 'Commits', color: 'var(--color-status-in-progress)' },
    prs: { label: 'PRs merged', color: 'var(--color-status-in-review)' },
  };

  return (
    <ChartCard
      title="Contribution"
      subtitle="Per member, for workload balance rather than ranking."
      isEmpty={rows.length === 0}
      emptyText="No attributed activity in this window."
    >
      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={rows} margin={{ left: 4, right: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis allowDecimals={false} width={32} {...axisProps} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="tasks" fill="var(--color-tasks)" radius={3} />
          <Bar dataKey="commits" fill="var(--color-commits)" radius={3} />
          <Bar dataKey="prs" fill="var(--color-prs)" radius={3} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function CiTrendCard({
  days,
}: {
  days: { day: string; successRate: number; total: number }[];
}) {
  const rows = days.map((d) => ({
    day: format(new Date(d.day), 'd MMM'),
    successRate: d.successRate,
    total: d.total,
  }));

  const config: ChartConfig = {
    successRate: { label: 'Success rate %', color: 'var(--color-status-done)' },
  };

  return (
    <ChartCard
      title="CI health"
      subtitle="Workflow success rate per day."
      isEmpty={rows.length === 0}
      emptyText="No completed CI runs recorded. Connect a repository to populate this."
    >
      <ChartContainer config={config} className="h-56 w-full">
        <LineChart data={rows} margin={{ left: 4, right: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="day" {...axisProps} />
          <YAxis domain={[0, 100]} width={32} {...axisProps} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="successRate"
            type="monotone"
            stroke="var(--color-successRate)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  );
}

function BurndownCard({
  sprint,
}: {
  sprint: {
    name: string;
    totalPoints: number;
    series: { date: string; remaining: number; ideal: number }[];
    note: string | null;
  };
}) {
  const rows = sprint.series.map((p) => ({
    date: format(new Date(p.date), 'd MMM'),
    remaining: p.remaining,
    ideal: p.ideal,
  }));

  const config: ChartConfig = {
    remaining: { label: 'Remaining', color: 'var(--color-primary)' },
    ideal: { label: 'Ideal', color: 'var(--color-muted-foreground)' },
  };

  return (
    <ChartCard
      className="mt-6"
      title={`Burndown — ${sprint.name}`}
      subtitle={`${sprint.totalPoints} points in scope.`}
      isEmpty={rows.length === 0}
      emptyText={sprint.note ?? 'Not enough data to draw a burndown.'}
    >
      <ChartContainer config={config} className="h-64 w-full">
        <LineChart data={rows} margin={{ left: 4, right: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="date" {...axisProps} />
          <YAxis allowDecimals={false} width={32} {...axisProps} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="ideal"
            type="linear"
            stroke="var(--color-ideal)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            dataKey="remaining"
            type="monotone"
            stroke="var(--color-remaining)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </ChartCard>
  );
}
