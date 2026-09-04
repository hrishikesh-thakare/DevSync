import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { HistoryIcon } from 'lucide-react';

import { ErrorState } from '@/components/layout/PageState';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

import { apiFetch, ApiError } from '@/lib/api';
import { describeAuditAction, summariseChanges } from '@/lib/auditActions';
import { initialsOf } from '@/lib/initials';
import type { AuditLogEntry } from '@/types/api';

/**
 * Renders `GET /audit/:entityType/:entityId`.
 *
 * Access is enforced server-side and differs by entity: `user` logs are visible
 * only to their own subject, everything else is workspace owner/admin only. A
 * 403 is therefore an ordinary outcome for a member, not a fault — it renders as
 * a quiet notice rather than an error.
 */
export function ActivityLog({
  entityType,
  entityId,
  limit = 50,
  emptyHint,
  filterable = false,
}: {
  entityType: string;
  entityId: string;
  limit?: number;
  emptyHint?: string;
  /** Shows an actor/action filter bar above the list. Off for small, per-entity
   * logs (a single task's history) where a filter bar is more chrome than the
   * list it would narrow. */
  filterable?: boolean;
}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [actorFilter, setActorFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;

    void (async () => {
      try {
        const data = await apiFetch(`/audit/${entityType}/${entityId}?limit=${limit}`);
        if (cancelled) return;
        setLogs(data.logs ?? []);
        setError(null);
        setForbidden(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        } else {
          setError(err instanceof Error ? err.message : 'Could not load the activity log.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, limit]);

  const { actors, actions } = useMemo(() => {
    const actorMap = new Map<string, string>();
    const actionSet = new Set<string>();
    for (const log of logs) {
      actorMap.set(log.actorId ?? '__system__', log.actorName ?? 'System');
      actionSet.add(log.action);
    }
    return {
      actors: [...actorMap.entries()].map(([value, label]) => ({ value, label })),
      actions: [...actionSet].map((value) => ({ value, label: describeAuditAction(value) })),
    };
  }, [logs]);

  const visibleLogs = useMemo(() => {
    if (!filterable) return logs;
    return logs.filter((log) => {
      if (actorFilter !== 'all' && (log.actorId ?? '__system__') !== actorFilter) return false;
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (dateFilter !== 'all') {
        const date = new Date(log.createdAt);
        const now = new Date();
        const days = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
        if (dateFilter === '7' && days > 7) return false;
        if (dateFilter === '30' && days > 30) return false;
      }
      return true;
    });
  }, [filterable, logs, actorFilter, actionFilter, dateFilter]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (forbidden) {
    return (
      <p className="text-sm text-muted-foreground">
        Only workspace owners and admins can view the activity log.
      </p>
    );
  }

  if (error) {
    return (
      <ErrorState message={error} />
    );
  }

  if (logs.length === 0) {
    return (
      <Empty className="rounded-2xl border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Nothing recorded yet</EmptyTitle>
          {emptyHint ? <EmptyDescription>{emptyHint}</EmptyDescription> : null}
        </EmptyHeader>
      </Empty>
    );
  }

  const filterBar = filterable ? (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <select
        value={actorFilter}
        onChange={(e) => setActorFilter(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">All actors</option>
        {actors.map((a) => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
      </select>
      
      <select
        value={actionFilter}
        onChange={(e) => setActionFilter(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">All actions</option>
        {actions.map((a) => (
          <option key={a.value} value={a.value}>{a.label}</option>
        ))}
      </select>

      <select
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">Any time</option>
        <option value="7">Past 7 days</option>
        <option value="30">Past 30 days</option>
      </select>

      {actorFilter !== 'all' || actionFilter !== 'all' || dateFilter !== 'all' ? (
        <button
          onClick={() => { setActorFilter('all'); setActionFilter('all'); setDateFilter('all'); }}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          Clear filters
        </button>
      ) : null}

      <div className="ml-auto">
        {visibleLogs.length !== logs.length ? (
          <p className="text-xs text-muted-foreground">
            {visibleLogs.length} of {logs.length}
          </p>
        ) : null}
      </div>
    </div>
  ) : null;

  if (filterable && visibleLogs.length === 0) {
    return (
      <>
        {filterBar}
        <Empty className="rounded-2xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No activity matches these filters</EmptyTitle>
            <EmptyDescription>Try clearing a filter to see more.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    );
  }

  return (
    <>
      {filterBar}
      <ul className="divide-y rounded-2xl border">
      {visibleLogs.map((log) => {
        const changes = summariseChanges(
          log.oldValues as Record<string, unknown> | null,
          log.newValues as Record<string, unknown> | null,
        );
        return (
          <li key={log.logId} className="flex gap-3 px-4 py-3">
            <Avatar className="size-7 shrink-0">
              {log.actorAvatar ? <AvatarImage src={log.actorAvatar} alt="" /> : null}
              <AvatarFallback className="text-[10px]">
                {initialsOf(log.actorName ?? 'System')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                <span className="font-medium">{log.actorName ?? 'System'}</span>{' '}
                <span className="text-muted-foreground">{describeAuditAction(log.action)}</span>
              </p>
              {changes.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {changes.slice(0, 4).map((c, i) => (
                    <li key={i} className="truncate font-mono text-xs text-muted-foreground">
                      {c}
                    </li>
                  ))}
                  {changes.length > 4 ? (
                    <li className="text-xs text-muted-foreground">
                      +{changes.length - 4} more fields
                    </li>
                  ) : null}
                </ul>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
              </p>
            </div>
          </li>
        );
      })}
      </ul>
    </>
  );
}
