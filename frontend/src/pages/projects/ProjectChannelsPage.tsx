import { Link, useParams } from 'react-router-dom';
import { HashIcon, LockIcon } from 'lucide-react';

import { EmptyState } from '@/components/layout/PageState';
import { Badge } from '@/components/ui/badge';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { useProjectStore } from '@/store/projectStore';

/** Channels scoped to this project — the workspace channel list filtered by projectId. */
export function ProjectChannelsPage() {
  const { slug = '' } = useParams();
  const channels = useCurrentWorkspaceStore((s) => s.channels);
  const project = useProjectStore((s) => s.project);

  const scoped = project ? channels.filter((c) => c.projectId === project.projectId) : [];

  return (
    <PageShell>
      <PageHeader
        title="Project channels"
        description="Discussions attached to this project. Task and sprint events are posted here."
      />

      {scoped.length === 0 ? (
        <EmptyState
          icon={<HashIcon aria-hidden="true" />}
          title="No project channels"
          description="Workspace admins can create a channel and attach it to this project."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {scoped.map((channel) => (
            <li key={channel.channelId}>
              <Link
                to={`/w/${slug}/channels/${channel.channelId}`}
                className="flex items-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/5 transition-shadow hover:ring-ring/40"
              >
                {channel.type === 'private' ? (
                  <LockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <HashIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{channel.name}</span>
                {channel.isAnnouncementOnly ? <Badge variant="secondary">announce</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
