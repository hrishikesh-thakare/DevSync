import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { HistoryIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
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
}: {
  entityType: string;
  entityId: string;
  limit?: number;
  emptyHint?: string;
}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

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
      <Alert variant="destructive">
        <AlertTitle>{error}</AlertTitle>
      </Alert>
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

  return (
    <ul className="divide-y rounded-2xl border">
      {logs.map((log) => {
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
  );
}
