import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { TriangleAlertIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/PageState';
import { useProjectStore, useMyProjectRole } from '@/store/projectStore';
import { useTaskStore } from '@/store/taskStore';
import { socketClient } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { TaskSummary } from '@/types/api';

const TABS = [
  { to: '', label: 'Board', end: true },
  { to: 'backlog', label: 'Backlog' },
  { to: 'sprints', label: 'Sprints' },
  { to: 'roadmap', label: 'Roadmap' },
  { to: 'calendar', label: 'Calendar' },
  { to: 'epics', label: 'Epics' },
  { to: 'analytics', label: 'Analytics' },
  { to: 'channels', label: 'Channels' },
  { to: 'labels', label: 'Labels' },
  { to: 'members', label: 'Members' },
  { to: 'github', label: 'GitHub' },
  { to: 'settings', label: 'Settings' },
] as const;

export function ProjectLayout() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { project, isLoading, error, fetchProject, reset } = useProjectStore();
  const myRole = useMyProjectRole();
  const applyTaskUpdate = useTaskStore((s) => s.applyTaskUpdate);

  useEffect(() => {
    if (slug && key) void fetchProject(slug, key);
    return () => reset();
  }, [slug, key, fetchProject, reset]);

  // Real-time task updates for the whole project
  useEffect(() => {
    if (!project?.projectId) return;

    const socket = socketClient.getSocket();
    if (!socket) return;

    // See `socketClient.joinRoom`: membership has to be re-asserted after a
    // reconnect, and this effect will not run again to do it.
    const releaseRoom = socketClient.joinRoom(`project:${project.projectId}`);

    const onTaskUpdated = (task: Partial<TaskSummary> & { taskId: string }) => {
      applyTaskUpdate(task);
    };

    socket.on('task_updated', onTaskUpdated);

    return () => {
      socket.off('task_updated', onTaskUpdated);
      releaseRoom();
    };
  }, [project?.projectId, applyTaskUpdate]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="mt-4 h-9 w-full rounded-lg" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <EmptyState
        className="min-h-[60svh]"
        icon={<TriangleAlertIcon aria-hidden="true" />}
        title="Couldn't open this project"
        description={error ?? 'It may have been archived, or you may not have access to it.'}
        action={<Button onClick={() => navigate(`/w/${slug}/projects`)}>Back to projects</Button>}
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b px-6 pt-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {project.key}
            </span>
            <h1 className="text-xl font-medium text-foreground">{project.name}</h1>
            {project.status === 'archived' ? <Badge variant="secondary">Archived</Badge> : null}
            {myRole ? (
              <Badge variant="outline" className="ml-auto">
                {myRole.replace('_', ' ')}
              </Badge>
            ) : null}
          </div>

          {/* A real tablist would need roving focus and arrow-key handling; these
              are navigation links that happen to look like tabs, so they stay
              links and get an aria-current instead. */}
          <nav aria-label="Project sections" className="mt-4 -mb-px flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <NavLink
                key={tab.label}
                to={tab.to ? `/w/${slug}/projects/${key}/${tab.to}` : `/w/${slug}/projects/${key}`}
                end={'end' in tab ? tab.end : false}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 border-b-2 px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'border-primary font-medium text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
