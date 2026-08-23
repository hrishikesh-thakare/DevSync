import { Link, NavLink, useParams } from 'react-router-dom';
import {
  FolderKanbanIcon,
  HashIcon,
  HistoryIcon,
  HomeIcon,
  ListTodoIcon,
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
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  const { name, projects, channels, isLoading, isAdmin, isOwner } = useCurrentWorkspaceStore();
  const canManage = isAdmin();
  const visibleProjects = projects.slice(0, SIDEBAR_LIST_CAP);
  const visibleChannels = channels.slice(0, SIDEBAR_LIST_CAP);
  const hiddenProjects = projects.length - visibleProjects.length;
  const hiddenChannels = channels.length - visibleChannels.length;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={name || 'Workspace'}>
              <Link to={`/w/${slug}`}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg text-xs">{initialsOf(name || slug)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{name || 'Loading…'}</span>
                  <span className="truncate text-xs text-muted-foreground">/w/{slug}</span>
                </div>
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
          <SidebarGroupLabel>Channels</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <SidebarMenuItem><SidebarMenuSkeleton showIcon /></SidebarMenuItem>
              ) : channels.length === 0 ? (
                <EmptyHint>No channels yet</EmptyHint>
              ) : (
                visibleChannels.map((channel) => (
                  <NavItem
                    key={channel.channelId}
                    to={`/w/${slug}/channels/${channel.channelId}`}
                    icon={<HashIcon />}
                    label={channel.name}
                  />
                ))
              )}
              {hiddenChannels > 0 ? (
                <MoreRow to={`/w/${slug}/channels`} count={hiddenChannels} />
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter />
      <SidebarRail />
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
}: {
  to: string;
  end?: boolean;
  icon?: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label}>
        <NavLink to={to} end={end}>
          {({ isActive }) => (
            <>
              {icon}
              {badge ? (
                <span
                  className={cn(
                    'rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground',
                    isActive && 'text-foreground',
                  )}
                >
                  {badge}
                </span>
              ) : null}
              <span className={cn('truncate', isActive && 'font-medium text-foreground')}>{label}</span>
            </>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
