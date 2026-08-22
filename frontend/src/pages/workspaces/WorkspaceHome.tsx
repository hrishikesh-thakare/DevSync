import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRightIcon,
  BellIcon,
  FolderKanbanIcon,
  HashIcon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { useNotificationStore } from '@/store/notificationStore';
import { initialsOf } from '@/lib/initials';
import { cn } from '@/lib/utils';

const FALLBACK_BLURB =
  'Jump back into a project or catch up on channel discussions.';

/**
 * The signed-in landing page.
 *
 * There is no `/dashboard` endpoint on the backend, so everything here is
 * composed from data the shell has already fetched — the only extra request is
 * the notification list, which is shared with the top-bar bell.
 */
export function WorkspaceHome() {
  const { slug = '' } = useParams();
  const {
    name,
    description,
    projects,
    channels,
    members,
    memberCount,
    myRole,
    isLoading,
    isOwner,
    isAdmin,
  } = useCurrentWorkspaceStore();
  const { notifications, fetchNotifications, markAsRead, resolveUrl } = useNotificationStore();
  const navigate = useNavigate();

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const openNotification = async (id: string) => {
    void markAsRead(id);
    try {
      navigate(await resolveUrl(id));
    } catch {
      // The target may have been deleted since the notification was written.
      navigate(`/w/${slug}/notifications`);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <section>
        <h1 className="text-2xl font-medium text-foreground">{name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description || FALLBACK_BLURB}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="gap-1.5">
            <ShieldIcon className="size-3.5" aria-hidden="true" />
            {myRole}
          </Badge>
          <span className="flex items-center gap-1.5">
            <UsersIcon className="size-4" aria-hidden="true" />
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </span>
          <span className="flex items-center gap-1.5">
            <FolderKanbanIcon className="size-4" aria-hidden="true" />
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
          <span className="flex items-center gap-1.5">
            <HashIcon className="size-4" aria-hidden="true" />
            {channels.length} {channels.length === 1 ? 'channel' : 'channels'}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild>
            <Link to={`/w/${slug}/projects`}>View all projects</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/w/${slug}/notifications`}>Notifications</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/w/${slug}/members`}>{isAdmin() ? 'Manage members' : 'View members'}</Link>
          </Button>
          {isOwner() ? (
            <Button asChild variant="outline">
              <Link to={`/w/${slug}/settings`}>Workspace settings</Link>
            </Button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanbanIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              Recent projects
            </CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link to={`/w/${slug}/projects`}>
                  View all
                  <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyRow>No projects yet.</EmptyRow>
            ) : (
              <ul className="flex flex-col gap-1">
                {projects.slice(0, 5).map((project) => (
                  <li key={project.projectId}>
                    <Link
                      to={`/w/${slug}/projects/${project.key}`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                    >
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {project.key}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {project.name}
                      </span>
                      {project.leadName ? (
                        <Avatar className="size-6">
                          {project.leadAvatar ? <AvatarImage src={project.leadAvatar} alt="" /> : null}
                          <AvatarFallback className="text-[10px]">
                            {initialsOf(project.leadName)}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                      <ArrowRightIcon
                        className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HashIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channels.length === 0 ? (
              <EmptyRow>No channels yet.</EmptyRow>
            ) : (
              <ul className="flex flex-col gap-1">
                {channels.slice(0, 5).map((channel) => (
                  <li key={channel.channelId}>
                    <Link
                      to={`/w/${slug}/channels/${channel.channelId}`}
                      className="group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                    >
                      <HashIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {channel.name}
                      </span>
                      <ArrowRightIcon
                        className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <EmptyRow>Activity on your tasks and channels shows up here.</EmptyRow>
            ) : (
              <ul className="flex flex-col gap-1">
                {notifications.slice(0, 5).map((n) => (
                  <li key={n.notificationId}>
                    <button
                      type="button"
                      onClick={() => void openNotification(n.notificationId)}
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <span
                        className={cn(
                          'mt-1.5 size-1.5 shrink-0 rounded-full',
                          n.isRead ? 'bg-transparent' : 'bg-primary',
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-sm',
                            !n.isRead && 'font-medium text-foreground',
                          )}
                        >
                          {n.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              Members
            </CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link to={`/w/${slug}/members`}>
                  View all
                  <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <EmptyRow>No members loaded.</EmptyRow>
            ) : (
              <ul className="flex flex-col gap-1">
                {members.slice(0, 5).map((member) => (
                  <li key={member.userId} className="flex items-center gap-3 px-2 py-2">
                    <Avatar className="size-7">
                      {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-[10px]">
                        {initialsOf(member.displayName || member.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {member.displayName || member.fullName}
                    </span>
                    <Badge variant="outline">{member.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
