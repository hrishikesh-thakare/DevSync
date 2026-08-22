import React, { useEffect, useState, useMemo } from 'react';
import { Outlet, useParams, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { useNotificationStore, Notification } from '../../store/useNotificationStore.js';
import { Hash, Lock, Search, Settings, Plus, FolderKanban, Loader2, Home, LogOut, ChevronDown as ChevronDownIcon, Command, Menu, ShieldAlert, Smartphone, Monitor, UserRound } from 'lucide-react';
import { CommandPalette } from '../../components/layout/CommandPalette.js';
import NotificationDropdown from '../../components/layout/NotificationDropdown.js';
import clsx from 'clsx';
import { socketClient } from '../../lib/socket.js';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { apiFetch } from '../../lib/api.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AppShellSkeleton } from '@/components/ui/skeletons';
import { useDelayedFlag } from '@/hooks/useDelayedFlag';
import { PresenceDot, normalizePresence, type Presence } from '@/components/ui/presence-dot';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';


export const WorkspaceLayout = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { notifications, fetchNotifications, addNotification } = useNotificationStore();
  const { name, projects, channels, members, isLoading, error, myRole, isAdmin, isOwner, fetchWorkspaceData, updateMemberPresence } = useCurrentWorkspaceStore();
  const toast = useToast();

  const channelUnreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    notifications.forEach((n) => {
      if (!n.isRead && n.channelId) {
        counts[n.channelId] = (counts[n.channelId] || 0) + 1;
      }
    });
    return counts;
  }, [notifications]);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [selectedDMMemberId, setSelectedDMMemberId] = useState('');
  const [newChannelType, setNewChannelType] = useState('public');
  const [isDefaultChannel, setIsDefaultChannel] = useState(false);
  const [isAnnouncementOnly, setIsAnnouncementOnly] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentUserMember = members.find(m => m.userId === user?.userId);
  const showSkeleton = useDelayedFlag(isLoading);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (slug) {
      fetchWorkspaceData(slug);
    }
  }, [slug, fetchWorkspaceData]);

  // Below 1024px the sidebar is an overlay drawer, so it has to close once
  // navigation lands — otherwise the scrim covers the page it just opened.
  // Adjusted during render (React's documented pattern for state derived from a
  // prop change) rather than from an effect, which would paint one frame with
  // the drawer still over the new route.
  const { pathname } = useLocation();
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    if (sidebarOpen) setSidebarOpen(false);
  }

  useEffect(() => {
    fetchNotifications();
    const socket = socketClient.getSocket();
    
    const handlePresenceUpdated = (data: { userId: string, presence?: string, statusText?: string, statusEmoji?: string }) => {
      updateMemberPresence(data.userId, data);
    };
    
    const handleNewNotification = (notification: Notification) => {
      addNotification(notification);
    };
    
    socket.on('user_presence_updated', handlePresenceUpdated);
    socket.on('new_notification', handleNewNotification);
    
    return () => {
      socket.off('user_presence_updated', handlePresenceUpdated);
      socket.off('new_notification', handleNewNotification);
    };
  }, [updateMemberPresence, fetchNotifications, addNotification]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName || !slug) return;
    setIsCreatingChannel(true);
    try {
      const { apiFetch } = await import('../../lib/api.js');
      await apiFetch(`/workspaces/${slug}/channels`, {
        method: 'POST',
        body: JSON.stringify({ 
          name: newChannelName, 
          type: newChannelType,
          isDefault: isDefaultChannel,
          isAnnouncementOnly: isAnnouncementOnly
        })
      });
      setShowChannelModal(false);
      setNewChannelName('');
      setIsDefaultChannel(false);
      setIsAnnouncementOnly(false);
      fetchWorkspaceData(slug);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the channel. Check the name is unique and try again.");
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleSelectStatus = async (newStatusText: string, presenceMode: Presence = 'online') => {
    if (user?.userId) {
      updateMemberPresence(user.userId, { statusText: newStatusText, presence: presenceMode });
    }
    try {
      const { apiFetch } = await import('../../lib/api.js');
      await apiFetch(`/auth/status`, {
        method: 'POST',
        body: JSON.stringify({ statusText: newStatusText, presence: presenceMode }),
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your status. Try again in a moment.");
    }
  };

  const handleClearStatus = async () => {
    if (user?.userId) {
      updateMemberPresence(user.userId, { statusText: '' });
    }
    try {
      const { apiFetch } = await import('../../lib/api.js');
      await apiFetch(`/auth/status`, {
        method: 'POST',
        body: JSON.stringify({ statusText: '' }),
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't clear your status. Try again in a moment.");
    }
  };

  const handleCreateDM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDMMemberId || !slug) return;
    setIsCreatingChannel(true);
    
    // Find member to construct a name
    const member = members.find(m => m.userId === selectedDMMemberId);
    if (!member) {
      setIsCreatingChannel(false);
      return;
    }
    
    const dmName = `dm-${user?.fullName.split(' ')[0]}-${member.fullName.split(' ')[0]}`.toLowerCase();

    try {
      const { apiFetch } = await import('../../lib/api.js');
      await apiFetch(`/workspaces/${slug}/channels`, {
        method: 'POST',
        body: JSON.stringify({ 
          name: dmName, 
          type: 'dm',
          memberIds: [selectedDMMemberId]
        })
      });
      setShowDMModal(false);
      setSelectedDMMemberId('');
      fetchWorkspaceData(slug);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the conversation. Try again in a moment.");
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // ─── Session / Device Management ─────────────────────────────────────────
  const confirm = useConfirm();
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessions, setSessions] = useState<Array<{
    tokenId: string;
    deviceInfo: { userAgent?: string; ip?: string } | null;
    issuedAt: string;
    expiresAt: string;
    isCurrent: boolean;
  }>>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);

  const getDeviceLabel = (ua?: string) => {
    if (!ua) return 'Unknown device';
    const os = ua.includes('Windows') ? 'Windows'
      : ua.includes('Mac') ? 'macOS'
      : ua.includes('Android') ? 'Android'
      : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'
      : ua.includes('Linux') ? 'Linux' : 'Unknown OS';
    const browser = ua.includes('Edg/') ? 'Edge'
      : ua.includes('Chrome/') ? 'Chrome'
      : ua.includes('Firefox/') ? 'Firefox'
      : ua.includes('Safari/') ? 'Safari' : 'Browser';
    return `${browser} · ${os}`;
  };

  const fetchSessions = async () => {
    setIsSessionsLoading(true);
    try {
      const data = await apiFetch('/auth/sessions');
      setSessions(data.sessions || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't load sessions. Check your connection and try again.");
    } finally {
      setIsSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (tokenId: string) => {
    try {
      await apiFetch(`/auth/sessions/${tokenId}/revoke`, { method: 'POST' });
      toast.success('Session logged out.');
      setSessions(s => s.filter(x => x.tokenId !== tokenId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't revoke session. Try again in a moment.");
    }
  };

  const handleRevokeOthers = async () => {
    if (!(await confirm({ message: 'Log out all other devices? You will stay signed in on this one.', isDestructive: true }))) return;
    try {
      await apiFetch('/auth/sessions/revoke-others', { method: 'POST' });
      toast.success('All other sessions logged out.');
      setSessions(s => s.filter(x => x.isCurrent));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't revoke sessions. Try again in a moment.");
    }
  };

  if (isLoading) {
    return showSkeleton ? <AppShellSkeleton /> : null;
  }

  if (error || !name) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground">
        <h2 className="text-h2 font-[590] text-danger mb-2">Workspace Error</h2>
        <p className="text-muted-foreground">{error || 'Workspace not found'}</p>
        <Button onClick={() => navigate('/workspaces')} className="mt-6 text-primary hover:underline" variant="ghost" size="default">
          Return to Hub
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans">

      {/* ─── SIDEBAR ────────────────────────────────────────────────────────── */}
      {/* Scrim behind the mobile drawer — §8 Side Panel, left-anchored. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[var(--z-overlay)] bg-overlay lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        id="workspace-sidebar"
        aria-label="Workspace"
        className={clsx(
          "w-[240px] bg-card flex flex-col flex-shrink-0 border-r border-border",
          // §11/§14: below 1024px this is an overlay drawer, not a column.
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-[var(--z-modal)]",
          "max-lg: transition-colors max-lg:duration-[--duration-slow] max-lg:ease-standard",
          sidebarOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        )}
      >

        {/* Workspace switcher — a real button, so it is keyboard-reachable. */}
        <button
          type="button"
          className="h-14 px-4 flex items-center justify-between gap-2 border-b border-border text-left hover:bg-hover transition-colors duration-[--duration-fast] ease-standard"
          onClick={() => navigate(`/w/${slug}`)}
        >
          <span className="font-[590] text-foreground truncate text-h3">{name}</span>
          <ChevronDownIcon className="w-4 h-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        </button>

        {/* Scrollable Nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-6">
          
          {/* Main Links */}
          <div className="px-3 space-y-0.5">
            <NavLink
              to={`/w/${slug}`}
              end
              className={({ isActive }) => clsx(
                "flex items-center px-2 py-1.5 rounded-md text-ui transition-colors group",
                isActive ? "bg-primary-muted text-primary-on-muted font-[510]" : "text-muted-foreground hover:bg-hover hover:text-foreground"
              )}
            >
              <Home className="w-4 h-4 mr-2.5" strokeWidth={1.75} />
              Dashboard
            </NavLink>
            <Button onClick={() => setShowCommandPalette(true)} className="w-full flex items-center px-2 py-1.5 rounded-md text-ui text-muted-foreground hover:bg-hover hover:text-foreground transition-colors group" variant="ghost" size="default">
              <Search className="w-4 h-4 mr-2.5" strokeWidth={1.75} />
              Search
              <kbd className="ml-auto rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-micro text-subtle-foreground">⌘K</kbd>
            </Button>
          </div>

          {/* Channels Section */}
          <div>
            <div className="px-5 mb-1.5 flex items-center justify-between group cursor-pointer">
              <span className="text-micro font-[510] text-subtle-foreground uppercase group-hover:text-muted-foreground transition-colors">Channels</span>
              {/* Only admin+ can create channels */}
              {isAdmin() && (
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChannelModal(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 text-subtle-foreground hover:text-foreground transition-colors"
                  size="icon" variant="ghost"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} />
                </Button>
              )}
            </div>
            <div className="px-3 space-y-0.5">
              {channels.filter(c => !c.projectId && c.type !== 'dm' && c.type !== 'group_dm').map((ch) => (
                <NavLink
                  key={ch.channelId}
                  to={`/w/${slug}/channels/${ch.channelId}`}
                  className={({ isActive }) => clsx(
                    "flex items-center px-2 py-1 rounded-md text-body transition-colors",
                    isActive ? "bg-primary-muted text-primary-on-muted font-[510]" : "text-muted-foreground hover:bg-hover hover:text-foreground"
                  )}
                >
                  {ch.type === 'private' ? (
                    <Lock className="w-4 h-4 mr-2 opacity-60" strokeWidth={1.75} />
                  ) : (
                    <Hash className="w-4 h-4 mr-2 opacity-60" strokeWidth={1.75} />
                  )}
                  <span className={clsx("truncate flex-1", channelUnreadCounts[ch.channelId] && "text-foreground font-[590]")}>{ch.name}</span>
                  {channelUnreadCounts[ch.channelId] ? (
                    <span className="ml-2 bg-primary text-primary-foreground text-micro font-[510] px-1.5 py-0.5 rounded-full leading-none flex items-center justify-center min-w-[16px] h-[16px]">
                      {channelUnreadCounts[ch.channelId]}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Projects Section */}
          <div>
            <div className="px-5 mb-1.5 flex items-center justify-between group">
              <Button
                type="button"
                onClick={() => navigate(`/w/${slug}/projects`)}
                className="text-micro font-[510] text-subtle-foreground uppercase group-hover:text-foreground transition-colors cursor-pointer"
                variant="ghost" size="default"
              >
                Projects
              </Button>
              {/* Only admin+ can create projects */}
              {isAdmin() && (
                <Button
                  type="button"
                  onClick={() => navigate(`/w/${slug}/projects/new`)}
                  aria-label={`Create project in ${name}`}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 text-subtle-foreground hover:text-foreground transition-colors"
                  size="icon" variant="ghost"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} />
                </Button>
              )}
            </div>
            <div className="px-3 space-y-0.5">
              {projects.map((proj) => (
                <div key={proj.projectId}>
                  <NavLink
                    to={`/w/${slug}/projects/${proj.key}`}
                    className={({ isActive }) => clsx(
                      "flex items-center px-2 py-1.5 rounded-md text-body transition-colors",
                      isActive ? "bg-primary-muted text-primary-on-muted font-[510]" : "text-muted-foreground hover:bg-hover hover:text-foreground"
                    )}
                  >
                    <FolderKanban className="w-4 h-4 mr-2.5 opacity-60" strokeWidth={1.75} />
                    <span className="truncate">{proj.name}</span>
                  </NavLink>
                  {/* Nested Project Channels */}
                  {channels.filter(c => c.projectId === proj.projectId).length > 0 && (
                    <div className="pl-6 pr-2 py-1 space-y-0.5">
                      {channels.filter(c => c.projectId === proj.projectId).map((ch) => (
                        <NavLink
                          key={ch.channelId}
                          to={`/w/${slug}/channels/${ch.channelId}`}
                          className={({ isActive }) => clsx(
                            "flex items-center px-2 py-1 rounded-md text-ui transition-colors",
                            isActive ? "bg-primary-muted text-primary-on-muted font-[510]" : "text-subtle-foreground hover:bg-hover hover:text-foreground"
                          )}
                        >
                          {ch.type === 'private' ? (
                            <Lock className="w-4 h-4 mr-2 opacity-60" strokeWidth={1.75} />
                          ) : (
                            <Hash className="w-4 h-4 mr-2 opacity-60" strokeWidth={1.75} />
                          )}
                          <span className={clsx("truncate flex-1", channelUnreadCounts[ch.channelId] && "text-foreground font-[590]")}>{ch.name}</span>
                          {channelUnreadCounts[ch.channelId] ? (
                            <span className="ml-2 bg-primary text-primary-foreground text-micro font-[510] px-1.5 py-0.5 rounded-full leading-none flex items-center justify-center min-w-[16px] h-[16px]">
                              {channelUnreadCounts[ch.channelId]}
                            </span>
                          ) : null}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div>
            <div className="px-5 mb-1.5 flex items-center justify-between group cursor-pointer">
              <span className="text-micro font-[510] text-subtle-foreground uppercase group-hover:text-muted-foreground transition-colors">Direct Messages</span>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDMModal(true);
                }}
                className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 text-subtle-foreground hover:text-foreground transition-colors"
                size="icon" variant="ghost"
              >
                <Plus className="w-4 h-4" strokeWidth={1.75} />
              </Button>
            </div>
            <div className="px-3 space-y-0.5">
              {channels.filter(c => c.type === 'dm' || c.type === 'group_dm').length === 0 ? (
                <p className="text-caption text-subtle-foreground px-2 py-2 italic">No conversations yet</p>
              ) : (
                channels.filter(c => c.type === 'dm' || c.type === 'group_dm').map((ch) => {
                  const dmMember = members.find(m => m.fullName === ch.name || m.displayName === ch.name);
                  return (
                    <NavLink
                      key={ch.channelId}
                      to={`/w/${slug}/channels/${ch.channelId}`}
                      className={({ isActive }) => clsx(
                        "flex items-center px-2 py-1 rounded-md text-body transition-colors group",
                        isActive ? "bg-primary-muted text-primary-on-muted font-[510]" : "text-muted-foreground hover:bg-hover hover:text-foreground"
                      )}
                    >
                      <div className="relative mr-2">
                        <Avatar size="sm" className="size-4 shrink-0">
                          <AvatarFallback className="bg-hover text-micro text-foreground font-[590]">
                            {ch.name?.charAt(0).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <PresenceDot presence={normalizePresence(dmMember?.presence, dmMember?.statusText)} ringClassName="ring-card" className="absolute -bottom-0.5 -right-0.5" />
                      </div>
                      <span className={clsx("truncate flex-1", channelUnreadCounts[ch.channelId] && "text-foreground font-[590]")}>{ch.name}</span>
                      {channelUnreadCounts[ch.channelId] ? (
                        <span className="ml-2 bg-primary text-primary-foreground text-micro font-[510] px-1.5 py-0.5 rounded-full leading-none flex items-center justify-center min-w-[16px] h-[16px]">
                          {channelUnreadCounts[ch.channelId]}
                        </span>
                      ) : null}
                      {dmMember?.statusText && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-micro text-subtle-foreground ml-1 truncate max-w-[80px]">{dmMember.statusText}</span>
                          </TooltipTrigger>
                          <TooltipContent>{dmMember.statusText}</TooltipContent>
                        </Tooltip>
                      )}
                    </NavLink>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Workspace Settings — only visible to admin/owner */}
        {isAdmin() && (
          <Button
            type="button"
            onClick={() => navigate(`/w/${slug}/settings`)}
            className="w-full p-4 text-left cursor-pointer group hover:bg-hover transition-colors"
            variant="ghost" size="default"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded bg-primary-muted border border-primary-border"></div>
                <span className="text-ui font-[510] text-muted-foreground group-hover:text-foreground transition-colors">Workspace Settings</span>
              </div>
              <Settings className="w-4 h-4 text-subtle-foreground group-hover:text-foreground" strokeWidth={1.75} />
            </div>
          </Button>
        )}

        {/* Audit Logs — only visible to owner */}
        {isOwner() && (
          <Button
            type="button"
            onClick={() => navigate(`/w/${slug}/audit-logs`)}
            className="w-full px-4 py-4 text-left cursor-pointer group hover:bg-hover transition-colors"
            variant="ghost" size="default"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded bg-elevated flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-subtle-foreground group-hover:text-foreground transition-colors" strokeWidth={1.75} />
                </div>
                <span className="text-ui font-[510] text-muted-foreground group-hover:text-foreground transition-colors">Audit Logs</span>
              </div>
            </div>
          </Button>
        )}
      </nav>

      {/* ─── MAIN CONTENT OUTLET ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Top Navbar / Utility Bar */}
        <header className="h-14 px-4 sm:px-6 flex items-center gap-3 justify-between bg-card border-b border-border shrink-0">
          {/* §14: hamburger opens the drawer below 1024px. */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
            aria-controls="workspace-sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
          </Button>
          {/* Search — a button, not a read-only input. It opens the command
              palette, so it has to be operable by keyboard like any other
              control; a div with an onClick is not. */}
          <div className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              aria-keyshortcuts="Meta+K Control+K"
              className="relative hidden sm:flex max-w-md w-full h-[32px] items-center gap-2 rounded-[6px] border border-input bg-input-bg pl-9 pr-16 text-left text-ui text-subtle-foreground transition-colors duration-[--duration-fast] ease-standard hover:bg-hover focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground" size={16} strokeWidth={1.75} aria-hidden="true" />
              Search tasks, messages…
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-micro text-subtle-foreground">
                <Command size={16} strokeWidth={1.75} aria-hidden="true" className="h-3 w-3" />
                <span>K</span>
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label="Search"
              onClick={() => setShowCommandPalette(true)}
            >
              <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>

          <div className="flex items-center space-x-4">
            {/* Light / dark mode */}
            
            {/* Notifications Dropdown */}
            <NotificationDropdown />

            {/* User Dropdown */}
            <DropdownMenu open={showUserDropdown} onOpenChange={setShowUserDropdown}>
              <DropdownMenuTrigger asChild>
                <Button
                  className="flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-hover transition-colors"
                  aria-label="User menu"
                  variant="ghost" size="default"
                >
                  <div className="relative">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-hover text-foreground text-caption font-[590]">
                        {user?.fullName?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <PresenceDot presence={normalizePresence(currentUserMember?.presence, currentUserMember?.statusText)} ringClassName="ring-card" className="absolute bottom-0 right-0" />
                  </div>
                  <div className="flex flex-col items-start hidden sm:flex">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-ui font-[510] text-muted-foreground">{user?.fullName?.split(' ')[0]}</span>
                      {currentUserMember?.statusText && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-micro bg-hover text-subtle-foreground px-1.5 py-0.5 rounded font-normal">{currentUserMember.statusText}</span>
                          </TooltipTrigger>
                          <TooltipContent>{currentUserMember.statusText}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  <ChevronDownIcon className="w-4 h-4 text-subtle-foreground" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[240px] p-0">
                <DropdownMenuLabel className="p-4 flex flex-col items-start gap-0.5 font-normal">
                  <span className="text-ui font-[590] text-foreground">{user?.fullName}</span>
                  <span className="text-caption text-subtle-foreground">{user?.email}</span>
                  <span className="mt-2 inline-block text-micro font-[590] uppercase px-2 py-0.5 rounded bg-hover text-muted-foreground">
                    {myRole}
                  </span>
                </DropdownMenuLabel>

                <div className="p-1 space-y-0.5">
                  <div className="px-2 py-1 flex items-center justify-between text-micro font-[510] text-subtle-foreground uppercase">
                    <span>Status</span>
                    {currentUserMember?.statusText && (
                      <Button
                        onClick={() => handleClearStatus()}
                        className="text-subtle-foreground hover:text-foreground normal-case font-normal text-caption"
                        variant="ghost" size="default"
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  {/* "Away" now writes the actual `away` presence. It used to
                      write `offline`, which is why §3's amber away dot was
                      unreachable and an away user read as signed out. */}
                  <DropdownMenuItem
                    onSelect={() =>
                      currentUserMember?.presence === 'online'
                        ? handleSelectStatus('Away', 'away')
                        : handleSelectStatus('Active', 'online')
                    }
                  >
                    <PresenceDot
                      presence={currentUserMember?.presence === 'online' ? 'away' : 'online'}
                      ringClassName="ring-popover"
                      className="mr-2"
                    />
                    <span>Set as {currentUserMember?.presence === 'online' ? 'Away' : 'Active'}</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1" />

                  {/* §3 Presence has exactly three states. Each preset maps to
                      one of them rather than inventing a hue per label: "here"
                      is online, "here but not responsive" is away, "not here"
                      is offline. The dot is the same PresenceDot the avatars
                      use, so there is one source for what a state looks like. */}
                  {[
                    { label: 'Active', presence: 'online' as const },
                    { label: 'In a meeting', presence: 'away' as const },
                    { label: 'Focusing', presence: 'away' as const },
                    { label: 'Commuting', presence: 'away' as const },
                    { label: 'Out sick', presence: 'offline' as const },
                    { label: 'Vacationing', presence: 'offline' as const },
                  ].map((preset) => (
                    <DropdownMenuItem
                      key={preset.label}
                      onSelect={() => handleSelectStatus(preset.label, preset.presence)}
                    >
                      <PresenceDot presence={preset.presence} ringClassName="ring-popover" className="mr-2" />
                      <span className="flex-1">{preset.label}</span>
                      {currentUserMember?.statusText === preset.label && (
                        <span className="text-micro text-primary font-[590]">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </div>

                <DropdownMenuSeparator />
                {isOwner() && (
                  <DropdownMenuItem onSelect={() => navigate(`/w/${slug}/settings`)}>
                    <Settings className="w-4 h-4 mr-3 text-subtle-foreground" strokeWidth={1.75} />
                    Workspace Settings
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => { setShowSessionsModal(true); fetchSessions(); }}>
                  <Monitor className="w-4 h-4 mr-3 text-subtle-foreground" strokeWidth={1.75} />
                  Manage Sessions
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/account')}>
                  <UserRound className="w-4 h-4 mr-3 text-subtle-foreground" strokeWidth={1.75} />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => handleLogout()}>
                  <LogOut className="w-4 h-4 mr-3" strokeWidth={1.75} />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dynamic Nested Content (Kanban, Chat, etc) */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>

      {/* CREATE CHANNEL MODAL */}
      {showChannelModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowChannelModal(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Channel</DialogTitle>
              <DialogDescription>Add a new channel to this workspace.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wl-channel-name">Channel Name</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground" aria-hidden="true">#</span>
                  <Input
                    id="wl-channel-name"
                    type="text"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="pl-8 font-mono text-ui"
                    placeholder="general"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-channel-type">Visibility</Label>
                <Select value={newChannelType} onValueChange={setNewChannelType}>
                  <SelectTrigger id="wl-channel-type" className="w-full bg-elevated">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Anyone in workspace</SelectItem>
                    <SelectItem value="private">Private - Invite only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="wl-default-channel"
                    checked={isDefaultChannel}
                    onCheckedChange={checked => setIsDefaultChannel(checked === true)}
                    className="mt-0.5 data-checked:border-success data-checked:bg-success data-checked:text-success-foreground"
                  />
                  <div className="flex flex-col">
                    <Label htmlFor="wl-default-channel" className="text-ui font-[510] text-foreground">Default Channel</Label>
                    <span className="text-caption text-subtle-foreground">New workspace members are automatically added</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="wl-announcement-only"
                    checked={isAnnouncementOnly}
                    onCheckedChange={checked => setIsAnnouncementOnly(checked === true)}
                    className="mt-0.5 data-checked:border-info data-checked:bg-info data-checked:text-info-foreground"
                  />
                  <div className="flex flex-col">
                    <Label htmlFor="wl-announcement-only" className="text-ui font-[510] text-foreground">Announcement Only</Label>
                    <span className="text-caption text-subtle-foreground">Only admins and the channel creator can post messages</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setShowChannelModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isCreatingChannel}>
                  {isCreatingChannel && <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.75} />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* CREATE DM MODAL */}
      {showDMModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowDMModal(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Start Direct Message</DialogTitle>
              <DialogDescription>Pick a teammate to start a private conversation.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateDM} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dm-member">Select Teammate</Label>
                <Select value={selectedDMMemberId} onValueChange={setSelectedDMMemberId}>
                  <SelectTrigger id="dm-member" className="w-full bg-elevated">
                    <SelectValue placeholder="Select a workspace member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.filter(m => m.userId !== user?.userId).map(m => (
                      <SelectItem key={m.userId} value={m.userId}>{m.fullName} ({m.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setShowDMModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isCreatingChannel}>
                  {isCreatingChannel && <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.75} />}
                  Start Chat
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Command Palette Modal */}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* SESSIONS MODAL */}
      {showSessionsModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowSessionsModal(false); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 py-4 shrink-0">
              <DialogTitle>Active Sessions</DialogTitle>
              <DialogDescription>Devices currently signed in to your account.</DialogDescription>
            </DialogHeader>

            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              {isSessionsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-foreground" strokeWidth={1.5} />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-subtle-foreground py-10">No active sessions.</p>
              ) : (
                sessions.map((session) => (
                  <div key={session.tokenId} className="flex items-center justify-between p-4 bg-elevated rounded-lg">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-hover flex items-center justify-center shrink-0">
                        {session.deviceInfo?.userAgent?.match(/Android|iPhone|iPad/i) ? (
                          <Smartphone className="w-4 h-4 text-subtle-foreground" strokeWidth={1.75} />
                        ) : (
                          <Monitor className="w-4 h-4 text-subtle-foreground" strokeWidth={1.75} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-ui font-[510] text-foreground truncate">
                            {getDeviceLabel(session.deviceInfo?.userAgent)}
                          </span>
                          {session.isCurrent && (
                            <span className="text-micro font-[590] uppercase bg-success/10 border border-success/30 text-success px-1.5 py-0.5 rounded">
                              This device
                            </span>
                          )}
                        </div>
                        <div className="text-caption text-subtle-foreground mt-0.5">
                          {session.deviceInfo?.ip && <span className="font-mono">{session.deviceInfo.ip}</span>}
                          <span className="mx-1.5">·</span>
                          Signed in {new Date(session.issuedAt).toLocaleString()}
                          <span className="mx-1.5">·</span>
                          expires {new Date(session.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        onClick={() => handleRevokeSession(session.tokenId)}
                        className="ml-3 shrink-0 text-caption font-[590] bg-hover text-muted-foreground px-3 py-1.5 rounded hover:bg-danger-muted hover:text-danger-on-muted transition-colors"
                        variant="secondary" size="default"
                      >
                        Log Out
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-6 pt-0 shrink-0">
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleRevokeOthers}
                disabled={sessions.filter(s => !s.isCurrent).length === 0}
              >
                Log Out All Other Devices
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};
