import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, MessageSquare, CheckCircle2, User, UserMinus, AtSign, ArrowRightLeft, Play, Hash, Mail, Briefcase, Building2, GitBranch } from 'lucide-react';
import clsx from 'clsx';
import { useNotificationStore } from '../store/useNotificationStore';
import { useCurrentWorkspaceStore } from '../store/currentWorkspace';

export const NotificationsInbox = () => {
  const { notifications, isLoading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
  const { slug } = useCurrentWorkspaceStore();
  const [viewMode, setViewMode] = useState<'all' | 'unread'>('all');
  const [filterType, setFilterType] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllRead = async () => {
    await markAllAsRead();
  };

  const markRead = async (id: string) => {
    const notif = notifications.find(n => n.notificationId === id);
    if (!notif?.isRead) {
      await markAsRead(id);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_assigned': return { icon: User, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'task_unassigned': return { icon: UserMinus, color: 'text-red-400 bg-red-500/10 border-red-500/20' };
      case 'task_commented': return { icon: MessageSquare, color: 'text-green-400 bg-green-500/10 border-green-500/20' };
      case 'task_mentioned': return { icon: AtSign, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      case 'task_status_changed': return { icon: ArrowRightLeft, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
      case 'sprint_started': return { icon: Play, color: 'text-green-400 bg-green-500/10 border-green-500/20' };
      case 'sprint_closed': return { icon: CheckCircle2, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' };
      case 'channel_mentioned': return { icon: Hash, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' };
      case 'dm_received': return { icon: Mail, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
      case 'commit_linked': 
      case 'commit_unlinked': return { icon: GitBranch, color: 'text-gray-200 bg-gray-700/50 border-gray-600/50' };
      case 'ci_passed': return { icon: GitBranch, color: 'text-green-400 bg-green-500/10 border-green-500/20' };
      case 'ci_failed': return { icon: GitBranch, color: 'text-red-500 bg-red-500/10 border-red-500/20' };
      case 'project_member_added': return { icon: Briefcase, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' };
      case 'workspace_invited': return { icon: Building2, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
      default: return { icon: Bell, color: 'text-gray-400 bg-white/10 border-white/20' };
    }
  };

  const localUnreadCount = notifications.filter(n => !n.isRead).length;

  // Apply filters
  let filtered = notifications;
  if (viewMode === 'unread') filtered = filtered.filter(n => !n.isRead);
  if (filterType !== 'all') {
    if (filterType === 'tasks') filtered = filtered.filter(n => n.type.startsWith('task_'));
    else if (filterType === 'sprints') filtered = filtered.filter(n => n.type.startsWith('sprint_'));
    else if (filterType === 'messages') filtered = filtered.filter(n => n.type === 'channel_mentioned' || n.type === 'dm_received');
    else if (filterType === 'github') filtered = filtered.filter(n => ['commit_linked', 'commit_unlinked', 'ci_failed', 'ci_passed'].includes(n.type));
    else if (filterType === 'membership') filtered = filtered.filter(n => n.type === 'project_member_added' || n.type === 'workspace_invited');
  }

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-gray-950 text-gray-200">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white">Inbox</h1>
            {localUnreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {localUnreadCount} new
              </span>
            )}
          </div>
          <button 
            onClick={markAllRead}
            disabled={localUnreadCount === 0}
            className="flex items-center text-sm font-medium text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4 mr-2" />
            Mark all as read
          </button>
        </div>

        {/* All / Unread Toggle + Type Filter */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <button
              onClick={() => setViewMode('all')}
              className={clsx("px-4 py-2 text-sm font-medium transition-colors", viewMode === 'all' ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200")}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('unread')}
              className={clsx("px-4 py-2 text-sm font-medium transition-colors", viewMode === 'unread' ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200")}
            >
              Unread
            </button>
          </div>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="tasks">Tasks</option>
            <option value="sprints">Sprints</option>
            <option value="messages">Messages</option>
            <option value="github">GitHub</option>
            <option value="membership">Membership</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-center text-gray-500 py-12">Loading...</div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden shadow-lg divide-y divide-gray-800/60">
            {filtered.map(notif => {
              const { icon: Icon, color } = getIcon(notif.type);
              return (
                <div 
                  key={notif.notificationId}
                  onClick={async () => {
                    markRead(notif.notificationId);
                    try {
                      const { apiFetch } = await import('../lib/api.js');
                      const data = await apiFetch(`/notifications/${notif.notificationId}/resolve`);
                      if (data.url) navigate(data.url);
                    } catch (err) {
                      console.error('Failed to resolve notification', err);
                    }
                  }}
                  className={clsx(
                    "flex items-start p-5 hover:bg-gray-800/40 cursor-pointer transition-colors relative group",
                    !notif.isRead ? "bg-gray-800/20" : ""
                  )}
                >
                  {!notif.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-full"></div>
                  )}
                  
                  <div className="mt-1 mr-4">
                    <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center border", color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className={clsx("text-sm mb-1", !notif.isRead ? "text-gray-100 font-bold" : "text-gray-300 font-medium")}>
                      {notif.title}
                    </p>
                    <span className="text-xs text-gray-500">{notif.body}</span>
                  </div>

                  {!notif.isRead && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); markRead(notif.notificationId); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-all"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
            
            {filtered.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{viewMode === 'unread' ? 'No unread notifications.' : "You're all caught up!"}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
