import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Loader2Icon, MonitorIcon } from 'lucide-react';

import { ErrorState } from '@/components/layout/PageState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { describeUserAgent } from '@/lib/userAgent';
import type { UserSession } from '@/types/api';

/**
 * A refresh token lives seven days and a new one is minted on every login, so
 * an account used across a few devices and a test suite accumulates hundreds of
 * live sessions. Rendering all of them buries the one row that matters. The
 * "sign out all other devices" action below still covers every session,
 * listed or not.
 */
const VISIBLE_LIMIT = 8;

export function SessionsCard() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/auth/sessions');
      setSessions(data.sessions ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your sessions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetching the session list on mount is the "subscribe to an external
    // system" case the rule exists to permit, and nothing here sets state
    // synchronously — every setState sits after the `await`. The rule flags it
    // anyway because `load` is a named callback it can follow statically.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const revoke = async (session: UserSession) => {
    setBusy(session.tokenId);
    try {
      await apiFetch(`/auth/sessions/${session.tokenId}/revoke`, { method: 'POST' });
      toast.success('Session revoked.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke that session.');
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    setBusy('others');
    try {
      await apiFetch('/auth/sessions/revoke-others', { method: 'POST' });
      toast.success('All other devices signed out.');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke the other sessions.');
    } finally {
      setBusy(null);
    }
  };

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  // The endpoint orders by `issuedAt` ascending, which puts the oldest sessions
  // first — the opposite of what is useful here. This device always leads.
  const visible = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
    });
    return sorted.slice(0, VISIBLE_LIMIT);
  }, [sessions]);

  const hiddenCount = sessions.length - visible.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>
          Every device holding a valid refresh token. Revoking one signs it out immediately.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <ErrorState message={error} />
        ) : null}

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {visible.map((s) => (
              <li key={s.tokenId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <MonitorIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {describeUserAgent(s.deviceInfo?.userAgent)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.deviceInfo?.ip && s.deviceInfo.ip !== 'unknown' ? `${s.deviceInfo.ip} · ` : ''}
                    signed in {formatDistanceToNow(new Date(s.issuedAt), { addSuffix: true })}
                  </p>
                </div>
                {s.isCurrent ? (
                  <Badge variant="secondary">This device</Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void revoke(s)}
                    disabled={busy === s.tokenId}
                  >
                    {busy === s.tokenId ? (
                      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Revoke
                  </Button>
                )}
              </li>
            ))}
            {hiddenCount > 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                {hiddenCount} older {hiddenCount === 1 ? 'session' : 'sessions'} not shown
              </li>
            ) : null}
          </ul>
        )}

        {otherCount > 0 ? (
          <div>
            <Button variant="outline" onClick={() => void revokeOthers()} disabled={busy === 'others'}>
              {busy === 'others' ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Sign out all other devices ({otherCount})
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
