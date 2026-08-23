import { useEffect, useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { TaskCardBody } from '@/pages/projects/board/TaskCard';
import type { TaskSummary } from '@/types/api';
import { Link } from 'react-router-dom';

interface MyTask extends TaskSummary {
  projectName: string;
  projectKey: string;
}

export function MyTasksPage() {
  const { slug: workspaceSlug } = useCurrentWorkspaceStore();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug) return;
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    apiFetch(`/workspaces/${workspaceSlug}/my-tasks`)
      .then((data) => setTasks(data.tasks))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tasks'))
      .finally(() => setIsLoading(false));
  }, [workspaceSlug]);

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <PageHeader title="My Tasks" description="Loading tasks assigned to you..." />
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Empty className="min-h-[60svh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Failed to load tasks</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-muted/20">
      <div className="mx-auto w-full max-w-7xl p-6">
        <PageHeader 
          title="My Tasks" 
          description="Everything assigned to you across all projects in this workspace." 
        />
        
        {tasks.length === 0 ? (
          <Empty className="mt-12 bg-background shadow-sm">
            <EmptyHeader>
              <EmptyTitle>You're all caught up</EmptyTitle>
              <EmptyDescription>
                You don't have any open tasks assigned to you right now.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tasks.map((task) => (
              <div key={task.taskId} className="flex flex-col gap-2">
                <Link to={`/w/${workspaceSlug}/projects/${task.projectKey}/tasks/${task.taskKey}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:underline">
                  {task.projectName} ({task.projectKey})
                </Link>
                <div className="pointer-events-none rounded-lg border bg-card text-card-foreground shadow-sm relative group overflow-hidden border-border/50 transition-colors p-3">
                  <TaskCardBody task={task} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
