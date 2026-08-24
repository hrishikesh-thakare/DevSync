import { ActivityLog } from '@/components/ActivityLog';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';

/**
 * The workspace audit trail.
 *
 * `getEntityAuditLogs` special-cases `entityType === 'workspace'`: instead of
 * matching `entity_id`, it returns every row whose `workspace_id` is this
 * workspace — so this one request covers projects, tasks, sprints, channels,
 * members and labels together.
 */
export function WorkspaceActivityPage() {
  const workspaceId = useCurrentWorkspaceStore((s) => s.workspaceId);
  const isLoading = useCurrentWorkspaceStore((s) => s.isLoading);

  return (
    <PageShell>
      <PageHeader
        title="Activity"
        description="Everything that has happened in this workspace, newest first."
      />

      {isLoading || !workspaceId ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <ActivityLog
          entityType="workspace"
          entityId={workspaceId}
          limit={100}
          filterable
          emptyHint="Actions are recorded as people create projects, move tasks and manage members."
        />
      )}
    </PageShell>
  );
}
