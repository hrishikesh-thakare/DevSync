import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRightIcon, LayersIcon, LogOutIcon, UserCogIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/layout/PageState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useWorkspaces } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/auth';
import { CreateWorkspaceDialog } from '@/pages/workspaces/CreateWorkspaceDialog';
import { PendingInvites } from '@/pages/workspaces/PendingInvites';
import { initialsOf } from '@/lib/initials';

/** Distinct per role so scanning a list of workspaces tells owned apart from joined at a glance. */
const ROLE_BADGE_VARIANT = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
} as const;

export function WorkspacePickerPage() {
  const { data: workspaces = [], isLoading, error } = useWorkspaces();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // `GET /workspaces` returns every membership row, not just the joined ones.
  // Only `active` rows are actually reachable — the workspace guard 403s on any
  // other state — so invites get their own section and `deactivated` rows (left
  // or removed) are dropped entirely.
  const { active, invited } = useMemo(
    () => ({
      active: workspaces.filter((w) => w.state === 'active'),
      invited: workspaces.filter((w) => w.state === 'invited'),
    }),
    [workspaces],
  );

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">
              {user ? `Welcome back, ${user.fullName.split(' ')[0]}` : 'Your workspaces'}
            </h1>
            <p className="mt-1 text-base text-muted-foreground">
              {user ? `Signed in as ${user.email}` : 'Pick a workspace to get started.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" asChild className="shadow-sm">
              <Link to="/account">
                <UserCogIcon className="size-4 mr-2" aria-hidden="true" />
                Account
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => void logout()} className="text-muted-foreground">
              <LogOutIcon className="size-4 mr-2" aria-hidden="true" />
              Sign out
            </Button>
            <CreateWorkspaceDialog />
          </div>
        </header>

        {error ? (
          <ErrorState message={error.message} className="mb-6" />
        ) : null}

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <PendingInvites invites={invited} />

            {active.length === 0 ? (
              <Empty className="rounded-2xl border shadow-sm mt-8 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <LayersIcon aria-hidden="true" className="size-8" />
                  </EmptyMedia>
                  <EmptyTitle className="text-xl">
                    {invited.length > 0 ? 'No workspaces joined yet' : 'No workspaces yet'}
                  </EmptyTitle>
                  <EmptyDescription className="text-base">
                    {invited.length > 0
                      ? 'Accept an invitation above, or create a workspace of your own.'
                      : 'Create one to start tracking projects, sprints and discussions.'}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="mt-6">
                  <CreateWorkspaceDialog />
                </EmptyContent>
              </Empty>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-8">
                {active.map((ws) => (
                  <li key={ws.workspaceId}>
                    <Card className="relative h-full flex flex-col transition-all hover:ring-1 hover:ring-ring/40">
                      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <Avatar className="size-10 rounded-xl">
                          {ws.iconUrl ? <AvatarImage src={ws.iconUrl} alt="" /> : null}
                          <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-medium">{initialsOf(ws.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="truncate">{ws.name}</CardTitle>
                          <CardDescription className="truncate">/w/{ws.slug}</CardDescription>
                        </div>
                        <Badge variant={ROLE_BADGE_VARIANT[ws.role as keyof typeof ROLE_BADGE_VARIANT] ?? 'outline'} className="shrink-0 capitalize">
                          {ws.role}
                        </Badge>
                      </CardHeader>
                      <CardContent className="flex-1">
                        {ws.description ? (
                          <p className="text-sm text-muted-foreground line-clamp-2">{ws.description}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground/60 italic">No description</p>
                        )}
                      </CardContent>
                      <CardFooter className="flex flex-row items-center justify-between mt-auto">
                        <span className="text-xs text-muted-foreground">
                          Joined {formatDistanceToNow(new Date(ws.joinedAt), { addSuffix: true })}
                        </span>
                        <Button size="sm" asChild>
                          <Link to={`/w/${ws.slug}`}>
                            Open
                            <ChevronRightIcon className="ml-1 size-3" aria-hidden="true" />
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

