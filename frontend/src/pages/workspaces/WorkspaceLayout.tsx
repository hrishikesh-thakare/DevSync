import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Outlet, useParams, NavLink, useNavigate } from 'react-router-dom';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { useNotificationStore, Notification } from '../../store/useNotificationStore.js';
import { Hash, Lock, Search, Settings, Plus, FolderKanban, Loader2, Home, X, LogOut, ChevronDown as ChevronDownIcon, Command, ShieldAlert, Smartphone, Monitor, UserRound } from 'lucide-react';
import { CommandPalette } from '../../components/layout/CommandPalette.js';
import NotificationDropdown from '../../components/layout/NotificationDropdown.js';
import clsx from 'clsx';
import { socketClient } from '../../lib/socket.js';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { apiFetch } from '../../lib/api.js';

const getStatusDotClass = (presence?: string, statusText?: string) => {
  if (presence === 'offline' || statusText === 'Away') return 'bg-gray-500';
  if (statusText === 'In a meeting' || statusText === 'Focusing') return 'bg-red-500';
  if (statusText === 'Commuting' || statusText === 'Out sick' || statusText === 'Vacationing') return 'bg-amber-500';
  return 'bg-green-500';
};

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentUserMember = members.find(m => m.userId === user?.userId);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
      toast.error(err instanceof Error ? err.message : 'Failed to create channel.');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleSelectStatus = async (newStatusText: string, presenceMode: 'online' | 'offline' = 'online') => {
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
      toast.error(err instanceof Error ? err.message : 'Failed to update status.');
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
      toast.error(err instanceof Error ? err.message : 'Failed to clear status.');
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
      toast.error(err instanceof Error ? err.message : 'Failed to create DM.');
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to load sessions.');
    } finally {
      setIsSessionsLoading(false);
    }
  };

  const handleRevokeSession = async (tokenId: string) => {
    try {
      await apiFetch(`/auth/sessions/${tokenId}/revoke`, { method: 'POST' });
      toast.success('Session logged out.');
      setSessions(s => s.filter(x => x.tokenId !== tokenId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke session.');
    }
  };

  const handleRevokeOthers = async () => {
    if (!(await confirm({ message: 'Log out all other devices? You will stay signed in on this one.', isDestructive: true }))) return;
    try {
      await apiFetch('/auth/sessions/revoke-others', { method: 'POST' });
      toast.success('All other sessions logged out.');
      setSessions(s => s.filter(x => x.isCurrent));
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke sessions.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !name) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-950 text-white">
        <h2 className="text-2xl font-bold text-red-500 mb-2">Workspace Error</h2>
        <p className="text-gray-400">{error || 'Workspace not found'}</p>
        <button onClick={() => navigate('/workspaces')} className="mt-6 text-gray-300 hover:underline">
          Return to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-gray-200 overflow-hidden font-sans">
      
      {/* ─── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800/60 flex flex-col flex-shrink-0">
        
        {/* Workspace Header */}
        <div 
          className="h-14 px-4 flex items-center justify-between border-b border-gray-800/60 shadow-sm hover:bg-gray-800/50 cursor-pointer transition-colors"
          onClick={() => navigate(`/w/${slug}`)}
        >
          <h1 className="font-bold text-white truncate text-lg">{name}</h1>
          <ChevronDownIcon className="w-4 h-4 text-gray-400" />
        </div>

        {/* Scrollable Nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-4 space-y-6">
          
          {/* Main Links */}
          <div className="px-3 space-y-0.5">
            <NavLink
              to={`/w/${slug}`}
              end
              className={({ isActive }) => clsx(
                "flex items-center px-2 py-1.5 rounded-md text-sm transition-colors group",
                isActive ? "bg-white/10 text-gray-300 font-medium" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
              )}
            >
              <Home className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" />
              Dashboard
            </NavLink>
            <button onClick={() => setShowCommandPalette(true)} className="w-full flex items-center px-2 py-1.5 rounded-md text-sm text-gray-400 hover:bg-gray-800/60 hover:text-gray-200 transition-colors group">
              <Search className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100" />
              Search
              <kbd className="ml-auto text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">⌘K</kbd>
            </button>
          </div>

          {/* Channels Section */}
          <div>
            <div className="px-5 mb-1.5 flex items-center justify-between group cursor-pointer">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 transition-colors">Channels</span>
              {/* Only admin+ can create channels */}
              {isAdmin() && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChannelModal(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="px-3 space-y-0.5">
              {channels.filter(c => !c.projectId && c.type !== 'dm' && c.type !== 'group_dm').map((ch) => (
                <NavLink
                  key={ch.channelId}
                  to={`/w/${slug}/channels/${ch.channelId}`}
                  className={({ isActive }) => clsx(
                    "flex items-center px-2 py-1 rounded-md text-[15px] transition-colors",
                    isActive ? "bg-white/10 text-gray-300 font-medium" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
                  )}
                >
                  {ch.type === 'private' ? (
                    <Lock className="w-3.5 h-3.5 mr-2 opacity-60" />
                  ) : (
                    <Hash className="w-4 h-4 mr-2 opacity-60" />
                  )}
                  <span className={clsx("truncate flex-1", channelUnreadCounts[ch.channelId] && "text-gray-200 font-bold")}>{ch.name}</span>
                  {channelUnreadCounts[ch.channelId] ? (
                    <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex items-center justify-center min-w-[16px] h-[16px]">
                      {channelUnreadCounts[ch.channelId]}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Projects Section */}
          <div>
            <div className="px-5 mb-1.5 flex items-center justify-between group cursor-pointer" onClick={() => navigate(`/w/${slug}/projects`)}>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 transition-colors">Projects</span>
              {/* Only admin+ can create projects */}
              {isAdmin() && (
                <button onClick={(e) => { e.stopPropagation(); navigate(`/w/${slug}/projects/new`); }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-all">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="px-3 space-y-0.5">
              {projects.map((proj) => (
                <div key={proj.projectId}>
                  <NavLink
                    to={`/w/${slug}/projects/${proj.key}`}
                    className={({ isActive }) => clsx(
                      "flex items-center px-2 py-1.5 rounded-md text-[14px] transition-colors",
                      isActive ? "bg-white/10 text-gray-300 font-medium" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
                    )}
                  >
                    <FolderKanban className="w-4 h-4 mr-2.5 opacity-60" />
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
                            "flex items-center px-2 py-1 rounded-md text-[13px] transition-colors",
                            isActive ? "bg-white/10 text-gray-300 font-medium" : "text-gray-500 hover:bg-gray-800/60 hover:text-gray-300"
                          )}
                        >
                          {ch.type === 'private' ? (
                            <Lock className="w-3.5 h-3.5 mr-2 opacity-60" />
                          ) : (
                            <Hash className="w-3.5 h-3.5 mr-2 opacity-60" />
                          )}
                          <span className={clsx("truncate flex-1", channelUnreadCounts[ch.channelId] && "text-gray-200 font-bold")}>{ch.name}</span>
                          {channelUnreadCounts[ch.channelId] ? (
                            <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex items-center justify-center min-w-[16px] h-[16px]">
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
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 transition-colors">Direct Messages</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDMModal(true);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-3 space-y-0.5">
              {channels.filter(c => c.type === 'dm' || c.type === 'group_dm').length === 0 ? (
                <p className="text-xs text-gray-600 px-2 py-2 italic">No conversations yet</p>
              ) : (
                channels.filter(c => c.type === 'dm' || c.type === 'group_dm').map((ch) => {
                  const dmMember = members.find(m => m.fullName === ch.name || m.displayName === ch.name);
                  return (
                    <NavLink
                      key={ch.channelId}
                      to={`/w/${slug}/channels/${ch.channelId}`}
                      className={({ isActive }) => clsx(
                        "flex items-center px-2 py-1 rounded-md text-[15px] transition-colors group",
                        isActive ? "bg-white/10 text-gray-300 font-medium" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
                      )}
                    >
                      <div className="relative mr-2">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-gray-700 to-gray-500 flex items-center justify-center text-[8px] text-white font-bold shrink-0">
                          {ch.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${getStatusDotClass(dmMember?.presence, dmMember?.statusText)} border border-gray-950 rounded-full`}></div>
                      </div>
                      <span className={clsx("truncate flex-1", channelUnreadCounts[ch.channelId] && "text-gray-200 font-bold")}>{ch.name}</span>
                      {channelUnreadCounts[ch.channelId] ? (
                        <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex items-center justify-center min-w-[16px] h-[16px]">
                          {channelUnreadCounts[ch.channelId]}
                        </span>
                      ) : null}
                      {dmMember?.statusText && (
                        <span className="text-[10px] text-gray-500 ml-1 truncate max-w-[80px]" title={dmMember.statusText}>{dmMember.statusText}</span>
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
          <div className="p-4 border-t border-gray-800/60" onClick={() => navigate(`/w/${slug}/settings`)}>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded bg-gradient-to-tr from-white to-white border border-gray-700"></div>
                <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Workspace Settings</span>
              </div>
              <Settings className="w-4 h-4 text-gray-500 group-hover:text-gray-300" />
            </div>
          </div>
        )}

        {/* Audit Logs — only visible to owner */}
        {isOwner() && (
          <div className="px-4 pb-4" onClick={() => navigate(`/w/${slug}/audit-logs`)}>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded bg-gray-900 border border-gray-800 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
                </div>
                <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Audit Logs</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ─── MAIN CONTENT OUTLET ────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950 relative">
        {/* Top Navbar / Utility Bar */}
        <header className="h-14 px-6 flex items-center justify-between border-b border-gray-800/60 bg-gray-950 shrink-0">
          {/* Search */}
          <div className="flex items-center flex-1">
             <div className="relative max-w-md w-full cursor-pointer" onClick={() => setShowCommandPalette(true)}>
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
               <input 
                 type="text" 
                 placeholder="Search tasks, messages..." 
                 className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-16 py-1.5 text-sm text-gray-400 cursor-pointer focus:outline-none"
                 readOnly
               />
               <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800 text-[10px] text-gray-500 font-mono">
                 <Command size={10} />
                 <span>K</span>
               </div>
             </div>
           </div>

          <div className="flex items-center space-x-4">
            {/* Notifications Dropdown */}
            <NotificationDropdown />

            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-gray-800/50 transition-colors"
              >
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-gray-600 to-gray-500 flex items-center justify-center text-white text-xs font-bold border border-gray-700">
                    {user?.fullName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${getStatusDotClass(currentUserMember?.presence, currentUserMember?.statusText)} rounded-full border-2 border-gray-950`} />
                </div>
                <div className="flex flex-col items-start hidden sm:flex">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm font-medium text-gray-300">{user?.fullName?.split(' ')[0]}</span>
                    {currentUserMember?.statusText && (
                      <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-normal" title={currentUserMember.statusText}>{currentUserMember.statusText}</span>
                    )}
                  </div>
                </div>
                <ChevronDownIcon className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-800">
                    <p className="text-sm font-semibold text-white">{user?.fullName}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                    <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-gray-300 border border-white/20">
                      {myRole}
                    </span>
                  </div>
                  
                  {/* Status Section — Slack-like Presets */}
                  <div className="border-b border-gray-800 p-2 space-y-1">
                    <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      <span>Status</span>
                      {currentUserMember?.statusText && (
                        <button 
                          onClick={() => handleClearStatus()} 
                          className="text-gray-500 hover:text-gray-300 normal-case font-normal text-xs"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Active / Away Presence Toggle */}
                    <button
                      onClick={() => handleSelectStatus(currentUserMember?.presence === 'online' ? 'Away' : 'Active', currentUserMember?.presence === 'online' ? 'offline' : 'online')}
                      className="w-full flex items-center px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-800 rounded transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full mr-2 ${currentUserMember?.presence === 'online' ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span>Set as {currentUserMember?.presence === 'online' ? 'Away' : 'Active'}</span>
                    </button>

                    <div className="border-t border-gray-800/60 my-1" />

                    {/* Preset Slack Statuses with Colored Dots */}
                    {[
                      { label: 'Active', presence: 'online' as const, color: 'bg-green-500' },
                      { label: 'In a meeting', presence: 'online' as const, color: 'bg-red-500' },
                      { label: 'Focusing', presence: 'online' as const, color: 'bg-red-500' },
                      { label: 'Commuting', presence: 'online' as const, color: 'bg-amber-500' },
                      { label: 'Out sick', presence: 'offline' as const, color: 'bg-amber-500' },
                      { label: 'Vacationing', presence: 'offline' as const, color: 'bg-amber-500' },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          handleSelectStatus(preset.label, preset.presence);
                          setShowUserDropdown(false);
                        }}
                        className={clsx(
                          "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded transition-colors text-left",
                          currentUserMember?.statusText === preset.label 
                            ? "bg-indigo-600/20 text-indigo-300 font-medium" 
                            : "text-gray-300 hover:bg-gray-800"
                        )}
                      >
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${preset.color}`} />
                          <span>{preset.label}</span>
                        </div>
                        {currentUserMember?.statusText === preset.label && (
                          <span className="text-[10px] text-indigo-400 font-bold">✓</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {isOwner() && (
                    <button 
                      onClick={() => { setShowUserDropdown(false); navigate(`/w/${slug}/settings`); }}
                      className="w-full flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800/60 transition-colors"
                    >
                      <Settings className="w-4 h-4 mr-3 text-gray-500" />
                      Workspace Settings
                    </button>
                  )}
                  <button 
                    onClick={() => { setShowUserDropdown(false); setShowSessionsModal(true); fetchSessions(); }}
                    className="w-full flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800/60 transition-colors"
                  >
                    <Monitor className="w-4 h-4 mr-3 text-gray-500" />
                    Manage Sessions
                  </button>
                  <button 
                    onClick={() => { setShowUserDropdown(false); navigate('/account'); }}
                    className="w-full flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800/60 transition-colors"
                  >
                    <UserRound className="w-4 h-4 mr-3 text-gray-500" />
                    Account Settings
                  </button>
                  <button 
                    onClick={() => { setShowUserDropdown(false); handleLogout(); }}
                    className="w-full flex items-center px-4 py-3 text-sm text-red-400 hover:bg-gray-800/60 transition-colors border-t border-gray-800"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Nested Content (Kanban, Chat, etc) */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>

      {/* CREATE CHANNEL MODAL */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Create Channel</h3>
              <button onClick={() => setShowChannelModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateChannel} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Channel Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                  <input 
                    type="text" 
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-8 pr-4 py-2 text-white focus:outline-none focus:border-white transition-colors font-mono text-sm"
                    placeholder="general"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Visibility</label>
                <select 
                  value={newChannelType}
                  onChange={e => setNewChannelType(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                >
                  <option value="public">Public - Anyone in workspace</option>
                  <option value="private">Private - Invite only</option>
                </select>
              </div>

              <div className="flex flex-col space-y-3 pt-2">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={isDefaultChannel}
                      onChange={e => setIsDefaultChannel(e.target.checked)}
                      className="peer appearance-none w-5 h-5 border border-gray-700 rounded bg-gray-950 checked:bg-emerald-500 checked:border-emerald-500 transition-all"
                    />
                    <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">Default Channel</span>
                    <span className="text-xs text-gray-500">New workspace members are automatically added</span>
                  </div>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={isAnnouncementOnly}
                      onChange={e => setIsAnnouncementOnly(e.target.checked)}
                      className="peer appearance-none w-5 h-5 border border-gray-700 rounded bg-gray-950 checked:bg-blue-500 checked:border-blue-500 transition-all"
                    />
                    <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">Announcement Only</span>
                    <span className="text-xs text-gray-500">Only admins and the channel creator can post messages</span>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowChannelModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-medium">Cancel</button>
                <button type="submit" disabled={isCreatingChannel} className="px-6 py-2 bg-white text-gray-950 hover:bg-gray-200 font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center">
                  {isCreatingChannel && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DM MODAL */}
      {showDMModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Start Direct Message</h3>
              <button onClick={() => setShowDMModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateDM} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Select Teammate</label>
                <div className="relative">
                  <select
                    value={selectedDMMemberId}
                    onChange={e => setSelectedDMMemberId(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                    required
                  >
                    <option value="" disabled>Select a workspace member</option>
                    {members.filter(m => m.userId !== user?.userId).map(m => (
                      <option key={m.userId} value={m.userId}>{m.fullName} ({m.email})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowDMModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-medium">Cancel</button>
                <button type="submit" disabled={isCreatingChannel} className="px-6 py-2 bg-white text-gray-950 hover:bg-gray-200 font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center">
                  {isCreatingChannel && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Start Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Command Palette Modal */}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* SESSIONS MODAL */}
      {showSessionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-white">Active Sessions</h3>
                <p className="text-sm text-gray-500 mt-0.5">Devices currently signed in to your account.</p>
              </div>
              <button onClick={() => setShowSessionsModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              {isSessionsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-gray-500 py-10">No active sessions.</p>
              ) : (
                sessions.map((session) => (
                  <div key={session.tokenId} className="flex items-center justify-between p-4 bg-gray-950 border border-gray-800 rounded-xl">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
                        {session.deviceInfo?.userAgent?.match(/Android|iPhone|iPad/i) ? (
                          <Smartphone className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Monitor className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-200 truncate">
                            {getDeviceLabel(session.deviceInfo?.userAgent)}
                          </span>
                          {session.isCurrent && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded">
                              This device
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {session.deviceInfo?.ip && <span className="font-mono">{session.deviceInfo.ip}</span>}
                          <span className="mx-1.5">·</span>
                          Signed in {new Date(session.issuedAt).toLocaleString()}
                          <span className="mx-1.5">·</span>
                          expires {new Date(session.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => handleRevokeSession(session.tokenId)}
                        className="ml-3 shrink-0 text-xs font-semibold bg-gray-800 text-gray-300 px-3 py-1.5 rounded hover:bg-red-500/10 hover:text-red-400 transition-colors border border-gray-700"
                      >
                        Log Out
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-6 pt-0 border-t border-gray-800/60 shrink-0">
              <button
                onClick={handleRevokeOthers}
                disabled={sessions.filter(s => !s.isCurrent).length === 0}
                className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-gray-700"
              >
                Log Out All Other Devices
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
