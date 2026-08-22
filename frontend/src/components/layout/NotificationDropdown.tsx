import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, UserPlus, UserMinus, MessageSquare, AtSign, ArrowRightCircle,
  MessageCircle, PlayCircle, CheckCircle, Mail, GitCommit, Settings, Check,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * §3 Notification Type Mapping — icon and ramp per type, taken from the table
 * verified against the real `notifications.type` enum.
 *
 * §15's "one icon, one meaning" is why AtSign covers both mention types rather
 * than splitting into AtSign/Hash, and why Mail is reserved for invitations
 * rather than doubling as the DM glyph.
 */
const TYPE_STYLES: Record<string, { Icon: typeof Bell; ramp: string }> = {
  task_assigned: { Icon: UserPlus, ramp: 'bg-primary-muted text-primary-on-muted' },
  task_unassigned: { Icon: UserMinus, ramp: 'bg-muted text-subtle-foreground' },
  task_mentioned: { Icon: AtSign, ramp: 'bg-primary-muted text-primary-on-muted' },
  task_commented: { Icon: MessageSquare, ramp: 'bg-primary-muted text-primary-on-muted' },
  task_status_changed: { Icon: ArrowRightCircle, ramp: 'bg-muted text-subtle-foreground' },
  channel_mentioned: { Icon: AtSign, ramp: 'bg-primary-muted text-primary-on-muted' },
  dm_received: { Icon: MessageCircle, ramp: 'bg-primary-muted text-primary-on-muted' },
  sprint_started: { Icon: PlayCircle, ramp: 'bg-special-muted text-special-on-muted' },
  sprint_closed: { Icon: CheckCircle, ramp: 'bg-special-muted text-special-on-muted' },
  commit_linked: { Icon: GitCommit, ramp: 'bg-muted text-subtle-foreground' },
  commit_unlinked: { Icon: GitCommit, ramp: 'bg-muted text-subtle-foreground' },
  workspace_invited: { Icon: Mail, ramp: 'bg-success-muted text-success-on-muted' },
  project_member_added: { Icon: UserPlus, ramp: 'bg-success-muted text-success-on-muted' },
};

/** §3: the icon sits in a 28px circle tinted with the ramp's -muted background. */
const TypeIcon = ({ type }: { type: string }) => {
  const { Icon, ramp } = TYPE_STYLES[type] ?? {
    Icon: Bell,
    ramp: 'bg-muted text-subtle-foreground',
  };
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ramp}`}
      aria-hidden="true"
    >
      <Icon size={16} strokeWidth={1.75} />
    </span>
  );
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
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, addNotification } =
    useNotificationStore();

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
      console.error('Could not open this notification', err);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    if (slug) {
      navigate(`/w/${slug}/notifications`);
    }
  };

  const displayNotifications = notifications.slice(0, 10);
  const latest = notifications[0];

  return (
    <>
      {/* §18 Live regions: "Incoming chat messages and notifications need
          aria-live=polite — a screen reader user won't otherwise know something
          arrived." Announcing only the newest keeps it to one utterance. */}
      <div aria-live="polite" className="sr-only">
        {latest && !latest.isRead ? `New notification: ${latest.title}` : ''}
      </div>

      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
            {unreadCount > 0 && (
              <Badge
                variant="unread"
                className="absolute top-0.5 right-0.5 min-w-[16px] justify-center px-1 py-0 text-micro"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0">
          <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 text-ui font-[510] text-foreground">
            <span>Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  onClick={() => markAllAsRead()}
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary hover:bg-primary-muted"
                >
                  Mark all as read
                </Button>
              )}
              <Button
                onClick={() => {
                  setIsOpen(false);
                  setIsSettingsOpen(true);
                }}
                variant="ghost"
                size="icon"
                aria-label="Notification settings"
              >
                <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
              </Button>
            </div>
          </DropdownMenuLabel>

          <div className="max-h-[400px] overflow-y-auto">
            {displayNotifications.length === 0 ? (
              // §8 Empty States: 32px icon in --text-muted, then a hint that
              // describes the next action rather than the absent state (§17).
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <Bell size={32} className="text-subtle-foreground" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-3 text-body font-[510] text-muted-foreground">No notifications</p>
                <p className="mt-1 max-w-[48ch] text-button text-subtle-foreground">
                  Mentions, assignments and sprint updates will appear here.
                </p>
              </div>
            ) : (
              displayNotifications.map((notif) => (
                // §8 Notification Rows: unread is marked by a 2px --primary left
                // bar AND a weight change — never by colour alone (§10).
                <div key={notif.notificationId} className="group relative border-b border-border last:border-b-0">
                  {!notif.isRead && (
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true" />
                  )}
                  <DropdownMenuItem
                    onSelect={() => handleNotificationClick(notif)}
                    className="mx-0 items-start gap-3 rounded-none px-4 py-3"
                  >
                    <TypeIcon type={notif.type} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={
                            notif.isRead
                              ? 'text-ui font-normal text-foreground'
                              : 'text-ui font-[510] text-foreground'
                          }
                        >
                          {notif.title}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-caption text-subtle-foreground">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </span>
                      {notif.body && (
                        <span className="mt-1 block truncate text-button text-subtle-foreground">
                          {notif.body}
                        </span>
                      )}
                    </span>
                  </DropdownMenuItem>

                  {/* §8: "Mark read | Ghost icon button, revealed on hover and on focus." */}
                  {!notif.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notif.notificationId);
                      }}
                      aria-label={`Mark as read: ${notif.title}`}
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                    >
                      <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          <DropdownMenuSeparator className="my-0" />
          <DropdownMenuItem
            onSelect={handleViewAll}
            className="justify-center rounded-none py-2 text-center font-[510]"
          >
            View all notifications
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isSettingsOpen && <NotificationSettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </>
  );
};

export default NotificationDropdown;
