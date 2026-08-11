import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, User, UserMinus, MessageSquare, AtSign, 
  ArrowRightLeft, Play, CheckCircle, Hash, 
  Mail, GitCommit, XCircle, Briefcase, Building2, Settings
} from 'lucide-react';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { useNotificationStore, Notification } from '../../store/useNotificationStore';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace';
import { socketClient } from '../../lib/socket';

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'task_assigned': return <User size={16} className="text-blue-400" />;
    case 'task_unassigned': return <UserMinus size={16} className="text-red-400" />;
    case 'task_commented': return <MessageSquare size={16} className="text-green-400" />;
    case 'task_mentioned': return <AtSign size={16} className="text-purple-400" />;
    case 'task_status_changed': return <ArrowRightLeft size={16} className="text-yellow-400" />;
    case 'sprint_started': return <Play size={16} className="text-green-400" />;
    case 'sprint_closed': return <CheckCircle size={16} className="text-gray-400" />;
    case 'channel_mentioned': return <Hash size={16} className="text-pink-400" />;
    case 'dm_received': return <Mail size={16} className="text-indigo-400" />;
    case 'commit_linked': return <GitCommit size={16} className="text-orange-400" />;
    case 'ci_failed': return <XCircle size={16} className="text-red-500" />;
    case 'project_member_added': return <Briefcase size={16} className="text-teal-400" />;
    case 'workspace_invited': return <Building2 size={16} className="text-blue-500" />;
    default: return <Bell size={16} className="text-gray-400" />;
  }
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffHours < 1) return `${diffMins}m ago`;
  if (diffDays < 1) return `${diffHours}h ago`;
  if (diffDays < 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { slug } = useCurrentWorkspaceStore();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, addNotification } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();

    const socket = socketClient.getSocket();
    if (socket) {
      socket.on('new_notification', (notification: Notification) => {
        addNotification(notification);
      });
    }

    return () => {
      if (socket) {
        socket.off('new_notification');
      }
    };
  }, [fetchNotifications, addNotification]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await markAsRead(notif.notificationId);
    }
    setIsOpen(false);
    
    try {
      const { apiFetch } = await import('../../lib/api.js');
      const data = await apiFetch(`/notifications/${notif.notificationId}/resolve`);
      if (data.url) navigate(data.url);
    } catch (err) {
      console.error('Failed to resolve notification', err);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    if (slug) {
      navigate(`/w/${slug}/notifications`);
    }
  };

  const displayNotifications = notifications.slice(0, 10);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-accent-purple text-[10px] font-bold text-white border-2 border-bg-primary">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-bg-elevated border border-border-default rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border-default flex items-center justify-between bg-bg-tertiary">
            <h3 className="font-bold text-white text-sm">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button 
                  onClick={() => markAllAsRead()}
                  className="text-xs text-accent-purple hover:text-accent-purple/80 font-medium"
                >
                  Mark all as read
                </button>
              )}
              <button 
                onClick={() => { setIsOpen(false); setIsSettingsOpen(true); }}
                className="text-text-muted hover:text-white transition-colors"
                title="Notification Settings"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[400px]">
            {displayNotifications.length === 0 ? (
              <div className="p-8 text-center text-text-muted flex flex-col items-center">
                <Bell size={24} className="mb-2 opacity-20" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              displayNotifications.map((notif) => (
                <div 
                  key={notif.notificationId}
                  onClick={() => handleNotificationClick(notif)}
                  className={`px-4 py-3 border-b border-border-default/50 hover:bg-white/5 cursor-pointer flex gap-3 transition-colors ${!notif.isRead ? 'bg-accent-purple/5' : ''}`}
                >
                  <div className="mt-1 relative flex-shrink-0">
                    {!notif.isRead && (
                      <span className="absolute -left-3 top-1.5 w-1.5 h-1.5 rounded-full bg-accent-purple"></span>
                    )}
                    {getTypeIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className={`text-sm ${!notif.isRead ? 'font-semibold text-white' : 'font-medium text-gray-300'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-text-muted whitespace-nowrap flex-shrink-0">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </div>
                    {notif.body && (
                      <p className="text-xs text-text-muted mt-1 truncate">
                        {notif.body}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-border-default bg-bg-tertiary">
            <button 
              onClick={handleViewAll}
              className="w-full py-2 text-sm text-center text-text-secondary hover:text-white font-medium rounded-md hover:bg-white/5 transition-colors"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
      
      {isSettingsOpen && (
        <NotificationSettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
};

export default NotificationDropdown;
