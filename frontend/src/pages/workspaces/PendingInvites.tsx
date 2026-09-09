import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2Icon, MailOpenIcon } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAcceptInvite } from '@/store/workspaceStore';
import { initialsOf } from '@/lib/initials';
import type { WorkspaceSummary } from '@/types/api';

/**
 * Workspaces the user has been invited to but has not joined.
 *
 * `GET /workspaces` returns every membership row regardless of state, so an
 * invite is simply a row with `state: 'invited'`. Until it is accepted the
 * workspace itself is unreachable — `requireWorkspaceRole` rejects any state
 * other than `active` with a 403 — so these must not be rendered as ordinary,
 * clickable workspaces.
 *
 * Accepting is `POST /workspaces/:slug/invites/accept`. There is no matching
 * decline endpoint: `DELETE /members/me` only acts on an `active` membership,
 * so offering "Decline" here would guarantee a 404.
 */
export function PendingInvites({ invites }: { invites: WorkspaceSummary[] }) {
  const acceptInvite = useAcceptInvite();
  const [busySlug, setBusySlug] = useState<string | null>(null);

  if (invites.length === 0) return null;

  const accept = async (ws: WorkspaceSummary) => {
    setBusySlug(ws.slug);
    try {
      await acceptInvite.mutateAsync(ws.slug);
      toast.success(`Joined ${ws.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept the invitation.');
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MailOpenIcon className="size-4" aria-hidden="true" />
        Pending invitations ({invites.length})
      </h2>

      <ul className="grid gap-3">
        {invites.map((ws) => (
          <li key={ws.workspaceId}>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4">
                <Avatar className="size-10 rounded-xl">
                  <AvatarFallback className="rounded-xl">{initialsOf(ws.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{ws.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    Invited as {ws.role.replace('_', ' ')}
                  </p>
                </div>
                <Badge variant="outline">Invited</Badge>
                <Button onClick={() => void accept(ws)} disabled={busySlug === ws.slug}>
                  {busySlug === ws.slug ? (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Accept
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
