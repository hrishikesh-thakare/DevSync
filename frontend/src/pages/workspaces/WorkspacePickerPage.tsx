import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon, LayersIcon, LogOutIcon } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/auth';
import { CreateWorkspaceDialog } from '@/pages/workspaces/CreateWorkspaceDialog';
import { initialsOf } from '@/lib/initials';

export function WorkspacePickerPage() {
  const { workspaces, isLoading, error, fetchWorkspaces } = useWorkspaceStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium text-foreground">Your workspaces</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user ? `Signed in as ${user.email}` : 'Pick a workspace to get started.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => void logout()}>
              <LogOutIcon className="size-4" aria-hidden="true" />
              Sign out
            </Button>
            <CreateWorkspaceDialog />
          </div>
        </header>

        {error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : workspaces.length === 0 ? (
          <Empty className="rounded-2xl border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayersIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No workspaces yet</EmptyTitle>
              <EmptyDescription>
                Create one to start tracking projects, sprints and discussions.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <CreateWorkspaceDialog />
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {workspaces.map((ws) => (
              <li key={ws.workspaceId}>
                <Card className="relative transition-shadow hover:ring-ring/40">
                  <CardContent>
                    <Link
                      to={`/w/${ws.slug}`}
                      className="flex items-center gap-4 outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      <Avatar className="size-10 rounded-xl">
                        <AvatarFallback className="rounded-xl">{initialsOf(ws.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{ws.name}</p>
                        <p className="truncate text-sm text-muted-foreground">/w/{ws.slug}</p>
                      </div>
                      <Badge variant={ws.role === 'owner' ? 'default' : 'secondary'}>{ws.role}</Badge>
                      <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
