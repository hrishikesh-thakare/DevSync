import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { BellIcon, CheckCheckIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { useNotificationStore } from '@/store/notificationStore';
import { initialsOf } from '@/lib/initials';
import { cn } from '@/lib/utils';

export function NotificationsInbox() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, fetchNotifications, markAsRead, markAllAsRead, resolveUrl } =
    useNotificationStore();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const open = async (id: string) => {
    void markAsRead(id);
    try {
      // The server owns the entity→URL mapping; never rebuild it here.
      navigate(await resolveUrl(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That item is no longer available.');
    }
  };

  const visible = showUnreadOnly ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowUnreadOnly((v) => !v)}>
              {showUnreadOnly ? 'Show all' : 'Unread only'}
            </Button>
            {unreadCount > 0 ? (
              <Button size="sm" onClick={() => void markAllAsRead()}>
                <CheckCheckIcon className="size-4" aria-hidden="true" />
                Mark all read
              </Button>
            ) : null}
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Empty className="rounded-2xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{showUnreadOnly ? 'Nothing unread' : 'No notifications'}</EmptyTitle>
            <EmptyDescription>
              Activity on your tasks, sprints and channels shows up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardContent className="px-0">
            <ul className="divide-y">
              {visible.map((n) => (
                <li key={n.notificationId}>
                  <button
                    type="button"
                    onClick={() => void open(n.notificationId)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        'mt-2 size-1.5 shrink-0 rounded-full',
                        n.isRead ? 'bg-transparent' : 'bg-primary',
                      )}
                      aria-hidden="true"
                    />

                    <Avatar className="size-8 shrink-0">
                      {n.actorAvatar ? <AvatarImage src={n.actorAvatar} alt="" /> : null}
                      <AvatarFallback className="text-[10px]">
                        {initialsOf(n.actorName ?? 'System')}
                      </AvatarFallback>
                    </Avatar>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm',
                          n.isRead ? 'text-muted-foreground' : 'font-medium text-foreground',
                        )}
                      >
                        {n.title}
                      </span>
                      {n.body ? (
                        <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
                      ) : null}
                      <span className="mt-1 flex items-center gap-2">
                        <Badge variant="outline">{n.type.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted-foreground">Workspace: {slug}</p>
    </PageShell>
  );
}
