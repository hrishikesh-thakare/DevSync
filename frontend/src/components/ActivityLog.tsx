import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { HistoryIcon, UserIcon, ZapIcon } from 'lucide-react';

import { ErrorState } from '@/components/layout/PageState';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Filters } from '@/components/reui/filters/filters';
import { createFilterQuery, flattenFilterConditions } from '@/components/reui/filters/filters-query';
import type { FilterField, FilterQuery } from '@/components/reui/filters/filters-types';
import { apiFetch, ApiError } from '@/lib/api';
import { describeAuditAction, summariseChanges } from '@/lib/auditActions';
import { initialsOf } from '@/lib/initials';
import type { AuditLogEntry } from '@/types/api';

/** Whether a select condition, applied to one value, matches. */
function conditionMatches(value: string, operator: string, values: unknown[], negated: boolean): boolean {
  const included = values.includes(value);
  const positive = operator === 'is' || operator === 'is_any_of';
  const result = positive ? included : !included;
  return negated ? !result : result;
}

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
  const [query, setQuery] = useState<FilterQuery>(() => createFilterQuery([]));

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

  // The audit endpoint takes no actor/action query params (it only paginates
  // by `limit`), so the filter bar narrows the batch already fetched rather
  // than round-tripping — same approach as every other list filter in the app.
  const fields = useMemo<FilterField[]>(() => {
    const actors = new Map<string, string>();
    const actions = new Set<string>();
    for (const log of logs) {
      actors.set(log.actorId ?? '__system__', log.actorName ?? 'System');
      actions.add(log.action);
    }
    return [
      {
        id: 'actor',
        label: 'Actor',
        type: 'select',
        defaultOperator: 'is_any_of',
        icon: <UserIcon />,
        options: [...actors.entries()].map(([value, label]) => ({ value, label })),
      },
      {
        id: 'action',
        label: 'Action',
        type: 'select',
        defaultOperator: 'is_any_of',
        icon: <ZapIcon />,
        options: [...actions].map((value) => ({ value, label: describeAuditAction(value) })),
      },
    ];
  }, [logs]);

  const visibleLogs = useMemo(() => {
    if (!filterable) return logs;
    const conditions = flattenFilterConditions(query);
    if (conditions.length === 0) return logs;
    return logs.filter((log) =>
      conditions.every((c) => {
        const value = c.field === 'actor' ? (log.actorId ?? '__system__') : log.action;
        return conditionMatches(value, c.operator, c.values, c.negated);
      }),
    );
  }, [filterable, logs, query]);

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
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Filters fields={fields} query={query} onQueryChange={setQuery} variant="basic" showClear />
      {visibleLogs.length !== logs.length ? (
        <p className="text-xs text-muted-foreground">
          {visibleLogs.length} of {logs.length}
        </p>
      ) : null}
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
