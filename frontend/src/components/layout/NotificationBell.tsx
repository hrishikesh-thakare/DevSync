import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { BellIcon, CheckCheckIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotificationStore } from '@/store/notificationStore';
import { cn } from '@/lib/utils';

export function NotificationBell({ slug }: { slug: string }) {
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, resolveUrl } =
    useNotificationStore();
  const navigate = useNavigate();

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const open = async (id: string) => {
    void markAsRead(id);
    try {
      navigate(await resolveUrl(id));
    } catch {
      // The target may have been deleted since the notification was written.
      navigate(`/w/${slug}/notifications`);
    }
  };

  const recent = notifications.slice(0, 8);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }>
          <BellIcon className="size-4" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-90">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={(e) => {
                e.preventDefault();
                void markAllAsRead();
              }}
            >
              <CheckCheckIcon className="size-3.5" aria-hidden="true" />
              Mark all read
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {recent.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          recent.map((n) => (
            <DropdownMenuItem
              key={n.notificationId}
              className="flex flex-col items-start gap-0.5"
              onSelect={() => void open(n.notificationId)}
            >
              <span className={cn('text-sm', !n.isRead && 'font-medium text-foreground')}>{n.title}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </span>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate(`/w/${slug}/notifications`)}>
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
