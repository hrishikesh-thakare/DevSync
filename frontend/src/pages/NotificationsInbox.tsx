import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { BellIcon, CheckCheckIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ErrorState } from '@/components/layout/PageState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Pager } from '@/components/Pager';

export function NotificationsInbox() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, error, fetchNotifications, markAsRead, markAllAsRead, resolveUrl } =
    useNotificationStore();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

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

  const availableTypes = Array.from(new Set(notifications.map((n) => n.type)));

  const visible = notifications.filter((n) => {
    if (showUnreadOnly && n.isRead) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  const ITEMS_PER_PAGE = 20;
  const paginatedVisible = visible.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {availableTypes.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { setShowUnreadOnly((v) => !v); setPage(1); }}>
              {showUnreadOnly ? 'Show all' : 'Unread only'}
            </Button>
            {unreadCount > 0 ? (
              <Button size="sm" onClick={() => void markAllAsRead()}>
                <CheckCheckIcon className="size-4" aria-hidden="true" />
                Mark all read
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? <ErrorState message={error} className="mb-4" /> : null}

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
        <Card className="py-0 sm:py-2">
          <CardContent className="px-0">
            <ul className="divide-y">
              {paginatedVisible.map((n) => (
                <li key={n.notificationId}>
                  <button
                    type="button"
                    onClick={() => void open(n.notificationId)}
                    className="flex w-full items-start gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="relative shrink-0">
                      {!n.isRead ? (
                        <span
                          className="absolute -left-2.5 sm:-left-3 top-1.5 size-1.5 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      ) : null}
                      <Avatar className="size-7 sm:size-8">
                        {n.actorAvatar ? <AvatarImage src={n.actorAvatar} alt="" /> : null}
                        <AvatarFallback className="text-[10px]">
                          {initialsOf(n.actorName ?? 'System')}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <span className="min-w-0 flex-1 pr-1">
                      <span
                        className={cn(
                          'block text-xs sm:text-sm',
                          n.isRead ? 'text-muted-foreground' : 'font-medium text-foreground',
                        )}
                      >
                        {n.title}
                      </span>
                      {n.body ? (
                        <span className="mt-0.5 block text-xs sm:text-sm text-muted-foreground">{n.body}</span>
                      ) : null}
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0">{n.type.replace(/_/g, ' ')}</Badge>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">
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

      {visible.length > ITEMS_PER_PAGE && (
        <div className="mt-4">
          <Pager
            page={page}
            totalPages={Math.ceil(visible.length / ITEMS_PER_PAGE)}
            totalCount={visible.length}
            onPage={setPage}
          />
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">Workspace: {slug}</p>
    </PageShell>
  );
}
