import React, { useEffect, useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'task_assigned': return <User size={16} className="text-primary" />;
    case 'task_unassigned': return <UserMinus size={16} className="text-danger" />;
    case 'task_commented': return <MessageSquare size={16} className="text-success" />;
    case 'task_mentioned': return <AtSign size={16} className="text-special" />;
    case 'task_status_changed': return <ArrowRightLeft size={16} className="text-warning" />;
    case 'sprint_started': return <Play size={16} className="text-success" />;
    case 'sprint_closed': return <CheckCircle size={16} className="text-muted-foreground" />;
    case 'channel_mentioned': return <Hash size={16} className="text-special" />;
    case 'dm_received': return <Mail size={16} className="text-primary" />;
    case 'commit_linked': return <GitCommit size={16} className="text-warning" />;
    case 'ci_failed': return <XCircle size={16} className="text-danger" />;
    case 'project_member_added': return <Briefcase size={16} className="text-success" />;
    case 'workspace_invited': return <Building2 size={16} className="text-primary" />;
    default: return <Bell size={16} className="text-muted-foreground" />;
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
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            onClick={() => setIsOpen(!isOpen)}
            variant="ghost"
            size="icon"
            className="relative p-2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none h-auto w-auto"
            aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground border-2 border-background">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0">
          <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 border-b border-border font-bold text-foreground text-sm">
            <span>Notifications</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <Button
                  onClick={() => markAllAsRead()}
                  variant="ghost"
                  className="text-xs text-primary hover:text-primary-hover font-medium h-auto"
                >
                  Mark all as read
                </Button>
              )}
              <Button
                onClick={() => { setIsOpen(false); setIsSettingsOpen(true); }}
                variant="ghost"
                size="icon"
                className="text-subtle-foreground hover:text-foreground transition-colors h-auto w-auto"
                aria-label="Notification Settings"
              >
                <Settings size={14} />
              </Button>
            </div>
          </DropdownMenuLabel>

          <div className="max-h-[400px] overflow-y-auto">
            {displayNotifications.length === 0 ? (
              <div className="p-8 text-center text-subtle-foreground flex flex-col items-center">
                <Bell size={24} className="mb-2 opacity-20" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              displayNotifications.map((notif) => (
                <DropdownMenuItem
                  key={notif.notificationId}
                  onSelect={() => handleNotificationClick(notif)}
                  className={`px-4 py-3 border-b border-border/50 cursor-pointer gap-3 ${!notif.isRead ? 'bg-primary-muted' : ''}`}
                >
                  <span className="self-start mt-1 relative flex-shrink-0">
                    {!notif.isRead && (
                      <span className="absolute -left-3 top-1.5 w-1.5 h-1.5 rounded-full bg-primary"></span>
                    )}
                    {getTypeIcon(notif.type)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex justify-between items-start gap-2">
                      <span className={`text-sm ${!notif.isRead ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-subtle-foreground whitespace-nowrap flex-shrink-0">
                        {formatTimeAgo(notif.createdAt)}
                      </span>
                    </span>
                    {notif.body && (
                      <span className="block text-xs text-subtle-foreground mt-1 truncate">
                        {notif.body}
                      </span>
                    )}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </div>

          <DropdownMenuSeparator className="my-0" />
          <DropdownMenuItem
            onSelect={handleViewAll}
            className="py-2 justify-center text-sm text-center text-muted-foreground focus:text-foreground font-medium"
          >
            View all notifications
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {isSettingsOpen && (
        <NotificationSettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
};

export default NotificationDropdown;