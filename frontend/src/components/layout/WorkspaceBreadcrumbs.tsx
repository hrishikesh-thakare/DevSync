import { Link, useLocation, useParams } from 'react-router-dom';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';

/** Route segments that name a page rather than an entity. */
const SECTION_LABELS: Record<string, string> = {
  'my-tasks': 'My Tasks',
  members: 'Members',
  settings: 'Settings',
  activity: 'Activity',
  notifications: 'Notifications',
  search: 'Search',
  channels: 'Channels',
  projects: 'Projects',
  analytics: 'Analytics',
  backlog: 'Backlog',
  sprints: 'Sprints',
  labels: 'Labels',
  github: 'GitHub',
  new: 'New',
};

interface Crumb {
  label: string;
  to?: string;
}

/**
 * Where am I?
 *
 * Nothing above the project tab strip told you: the task page showed only a key
 * like PLAT-142, with no indication of which project or workspace it belonged
 * to. The trail is derived from the route rather than threaded through props,
 * so no page has to remember to render it.
 */
export function WorkspaceBreadcrumbs() {
  const { slug = '', key: projectKey, taskKey, channelId } = useParams();
  const { pathname } = useLocation();
  const { name: workspaceName, projects, channels } = useCurrentWorkspaceStore();

  // Everything after `/w/:slug`.
  const segments = pathname.split('/').filter(Boolean).slice(2);
  if (segments.length === 0) return null;

  const crumbs: Crumb[] = [{ label: workspaceName || slug, to: `/w/${slug}` }];

  if (segments[0] === 'projects' && projectKey) {
    const project = projects.find((p) => p.key === projectKey);
    crumbs.push({ label: 'Projects', to: `/w/${slug}/projects` });
    crumbs.push({
      label: project?.name ?? projectKey,
      to: `/w/${slug}/projects/${projectKey}`,
    });

    // The tab within the project, if we are not on the board itself.
    const tail = segments[2];
    if (taskKey) {
      crumbs.push({ label: taskKey });
    } else if (tail) {
      crumbs.push({ label: SECTION_LABELS[tail] ?? tail });
    }
  } else if (segments[0] === 'channels' && channelId) {
    const channel = channels.find((c) => c.channelId === channelId);
    crumbs.push({ label: 'Channels', to: `/w/${slug}/channels` });
    crumbs.push({ label: channel ? `#${channel.name}` : 'Channel' });
  } else {
    const section = segments[0];
    crumbs.push({ label: SECTION_LABELS[section] ?? section });
  }

  // A lone workspace crumb is noise — the sidebar already says where you are.
  if (crumbs.length < 2) return null;

  return (
    <Breadcrumb className="hidden min-w-0 md:block">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <BreadcrumbItem key={`${crumb.label}-${i}`} className="min-w-0">
              {isLast || !crumb.to ? (
                <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink asChild className="truncate">
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
