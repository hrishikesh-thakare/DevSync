import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import {
  ChartLineIcon,
  FolderKanbanIcon,
  HashIcon,
  HistoryIcon,
  HomeIcon,
  ListTodoIcon,
  LockIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StartDmDialog } from '@/components/layout/StartDmDialog';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { initialsOf } from '@/lib/initials';
import { cn } from '@/lib/utils';

/**
 * A busy workspace can carry hundreds of projects and channels. Rendering
 * every one of them puts a thousand nodes in the sidebar and buries the
 * navigation, so the list is capped and overflow moves to the index page.
 */
const SIDEBAR_LIST_CAP = 8;

export function WorkspaceSidebar() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { name, projects, channels, isLoading, isAdmin, isOwner } = useCurrentWorkspaceStore();
  const [dmOpen, setDmOpen] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);
  const canManage = isAdmin();
  const visibleProjects = projects.slice(0, SIDEBAR_LIST_CAP);
  const hiddenProjects = projects.length - visibleProjects.length;

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.projectId, p])),
    [projects],
  );

  const directChannels = channels.filter((c) => c.type === 'dm' || c.type === 'group_dm');

  const workspaceChannels = channels.filter(
    (c): c is typeof c & { name: string } =>
      c.type !== 'dm' && c.type !== 'group_dm' && !c.projectId,
  );
  const visibleWorkspaceChannels = workspaceChannels.slice(0, SIDEBAR_LIST_CAP);
  const hiddenWorkspaceChannels = workspaceChannels.length - visibleWorkspaceChannels.length;

  const projectChannels = channels.filter(
    (c): c is typeof c & { name: string } =>
      c.type !== 'dm' && c.type !== 'group_dm' && Boolean(c.projectId),
  );
  const visibleProjectChannels = projectChannels.slice(0, SIDEBAR_LIST_CAP);
  const hiddenProjectChannels = projectChannels.length - visibleProjectChannels.length;

  const directMessageLabel = (channel: (typeof directChannels)[number]): string =>
    channel.otherParticipants?.map((p) => p.displayName || p.fullName).join(', ') || 'Direct message';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={name || 'Workspace'}>
              <Link to={`/w/${slug}`}>
                <Avatar className="size-8 border-2 border-primary/30">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{initialsOf(name || slug)}</AvatarFallback>
                </Avatar>
                <span className="truncate font-medium flex-1 text-left">{name || 'Loading…'}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem to={`/w/${slug}`} end icon={<HomeIcon />} label="Home" />
              <NavItem to={`/w/${slug}/my-tasks`} icon={<ListTodoIcon />} label="My Tasks" />
              <NavItem to={`/w/${slug}/projects`} icon={<FolderKanbanIcon />} label="Projects" />
              <NavItem to={`/w/${slug}/members`} icon={<UsersIcon />} label="Members" />
              {/* Open to every member — the endpoint scopes the rollup to the
                  projects they actually belong to rather than refusing them. */}
              <NavItem to={`/w/${slug}/analytics`} icon={<ChartLineIcon />} label="Analytics" />
              {/* The audit endpoint refuses anyone below admin, so linking it
                  for a plain member would only lead to a 403. */}
              {canManage ? (
                <NavItem to={`/w/${slug}/activity`} icon={<HistoryIcon />} label="Activity" />
              ) : null}
              {isOwner() ? (
                <NavItem to={`/w/${slug}/settings`} icon={<SettingsIcon />} label="Settings" />
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          {/* Creating a project is owner/admin only server-side; hiding the
              control avoids offering an action that is guaranteed to 403. */}
          {canManage ? (
            <SidebarGroupAction asChild title="New project">
              <Link to={`/w/${slug}/projects/new`}>
                <PlusIcon />
                <span className="sr-only">New project</span>
              </Link>
            </SidebarGroupAction>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <>
                  <SidebarMenuItem><SidebarMenuSkeleton showIcon /></SidebarMenuItem>
                  <SidebarMenuItem><SidebarMenuSkeleton showIcon /></SidebarMenuItem>
                </>
              ) : projects.length === 0 ? (
                <EmptyHint>No projects yet</EmptyHint>
              ) : (
                visibleProjects.map((project) => (
                  <NavItem
                    key={project.projectId}
                    to={`/w/${slug}/projects/${project.key}`}
                    label={project.name}
                    badge={project.key}
                  />
                ))
              )}
              {hiddenProjects > 0 ? (
                <MoreRow to={`/w/${slug}/projects`} count={hiddenProjects} />
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Direct Messages</SidebarGroupLabel>
          <SidebarGroupAction
            title="New direct message"
            onClick={() => setDmOpen(true)}
          >
            <PlusIcon />
            <span className="sr-only">New direct message</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <SidebarMenuItem><SidebarMenuSkeleton showIcon /></SidebarMenuItem>
              ) : directChannels.length === 0 ? (
                <EmptyHint>No conversations yet — click + to message someone</EmptyHint>
              ) : (
                directChannels.map((channel) => (
                  <NavItem
                    key={channel.channelId}
                    to={`/w/${slug}/channels/${channel.channelId}`}
                    icon={<MessageSquareIcon />}
                    label={directMessageLabel(channel)}
                  />
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace Channels</SidebarGroupLabel>
          {canManage ? (
            <SidebarGroupAction asChild title="New workspace channel">
              <Link to={`/w/${slug}/channels?new=true&scope=workspace`}>
                <PlusIcon />
                <span className="sr-only">New workspace channel</span>
              </Link>
            </SidebarGroupAction>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <SidebarMenuItem><SidebarMenuSkeleton showIcon /></SidebarMenuItem>
              ) : workspaceChannels.length === 0 ? (
                <EmptyHint>No workspace channels yet</EmptyHint>
              ) : (
                visibleWorkspaceChannels.map((channel) => (
                  <NavItem
                    key={channel.channelId}
                    to={`/w/${slug}/channels/${channel.channelId}`}
                    icon={channel.type === 'private' ? <LockIcon /> : <HashIcon />}
                    label={channel.name}
                    tooltip={`#${channel.name} · Workspace`}
                  />
                ))
              )}
              {hiddenWorkspaceChannels > 0 ? (
                <MoreRow to={`/w/${slug}/channels?scope=workspace`} count={hiddenWorkspaceChannels} />
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Project Channels</SidebarGroupLabel>
          {canManage ? (
            <SidebarGroupAction asChild title="New project channel">
              <Link to={`/w/${slug}/channels?new=true&scope=projects`}>
                <PlusIcon />
                <span className="sr-only">New project channel</span>
              </Link>
            </SidebarGroupAction>
          ) : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <SidebarMenuItem><SidebarMenuSkeleton showIcon /></SidebarMenuItem>
              ) : projectChannels.length === 0 ? (
                <EmptyHint>No project channels yet</EmptyHint>
              ) : (
                visibleProjectChannels.map((channel) => {
                  const project = channel.projectId ? projectMap.get(channel.projectId) : undefined;
                  return (
                    <NavItem
                      key={channel.channelId}
                      to={`/w/${slug}/channels/${channel.channelId}`}
                      icon={channel.type === 'private' ? <LockIcon /> : <HashIcon />}
                      label={channel.name}
                      badge={project?.key}
                      badgePosition="end"
                      tooltip={project ? `#${channel.name} · ${project.name}` : `#${channel.name}`}
                    />
                  );
                })
              )}
              {hiddenProjectChannels > 0 ? (
                <MoreRow to={`/w/${slug}/channels?scope=projects`} count={hiddenProjectChannels} />
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter />
      <SidebarRail />
      <StartDmDialog open={dmOpen} onOpenChange={setDmOpen} slug={slug} />
    </Sidebar>
  );
}

function MoreRow({ to, count }: { to: string; count: number }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={`${count} more`}>
        <Link to={to}>
          <MoreHorizontalIcon />
          <span className="truncate text-muted-foreground">{count} more</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <SidebarMenuItem>
      <span className="px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        {children}
      </span>
    </SidebarMenuItem>
  );
}

function NavItem({
  to,
  end,
  icon,
  label,
  badge,
  badgePosition = 'start',
  tooltip,
}: {
  to: string;
  end?: boolean;
  icon?: React.ReactNode;
  label: string;
  badge?: string;
  badgePosition?: 'start' | 'end';
  tooltip?: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={tooltip || label}>
        <NavLink to={to} end={end}>
          {({ isActive }) => (
            <>
              {icon}
              {badge && badgePosition === 'start' ? (
                <span
                  className={cn(
                    'rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden',
                    isActive && 'text-foreground',
                  )}
                >
                  {badge}
                </span>
              ) : null}
              <span className={cn('truncate flex-1 text-left', isActive && 'font-medium text-foreground')}>{label}</span>
              {badge && badgePosition === 'end' ? (
                <span
                  className={cn(
                    'ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground group-data-[collapsible=icon]:hidden',
                    isActive && 'text-foreground',
                  )}
                >
                  {badge}
                </span>
              ) : null}
            </>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
