import { Link, useParams } from 'react-router-dom';
import { FolderKanbanIcon, PlusIcon } from 'lucide-react';

import { MemberAvatar } from '@/components/MemberAvatar';
import { ErrorState } from '@/components/layout/PageState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';

export function ProjectListPage() {
  const { slug = '' } = useParams();
  const { projects, isLoading, isAdmin, error } = useCurrentWorkspaceStore();
  const canCreate = isAdmin();

  const newProjectButton = canCreate ? (
    <Button asChild>
      <Link to={`/w/${slug}/projects/new`}>
        <PlusIcon className="size-4" aria-hidden="true" />
        New project
      </Link>
    </Button>
  ) : null;

  return (
    <PageShell>
      <PageHeader
        title="Projects"
        description={
          canCreate
            ? 'Every project has its own board, backlog, sprints and channels.'
            : 'Projects you have been given access to in this workspace.'
        }
        actions={newProjectButton}
      />

      {error ? <ErrorState message={error} className="mb-4" /> : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Empty className="rounded-2xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanbanIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              {canCreate
                ? 'Create the first project to start tracking work.'
                : 'You have not been added to a project in this workspace yet. An admin can add you.'}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{newProjectButton}</EmptyContent>
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.projectId}>
              <Card className="relative h-full transition-shadow hover:ring-ring/40">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {project.key}
                    </span>
                    {project.leadName ? (
                      // The card is a link overlay, so the avatar sits above it
                      // to keep its tooltip hoverable.
                      <span className="relative z-10 ml-auto">
                        {/* ProjectSummary carries no leadUserId, so presence
                            cannot be resolved here — the dot is omitted rather
                            than guessed. */}
                        <MemberAvatar
                          size="sm"
                          member={{
                            fullName: `${project.leadName} · Lead`,
                            avatarUrl: project.leadAvatar,
                          }}
                        />
                      </span>
                    ) : null}
                  </div>

                  <Link
                    to={`/w/${slug}/projects/${project.key}`}
                    className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    <span className="font-medium text-foreground">{project.name}</span>
                  </Link>

                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {project.description || 'No description yet.'}
                  </p>

                  <p className="mt-auto text-xs text-muted-foreground">
                    {project.issueCounter} {project.issueCounter === 1 ? 'issue' : 'issues'} created
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
