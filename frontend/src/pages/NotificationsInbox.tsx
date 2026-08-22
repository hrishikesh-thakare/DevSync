import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, MessageSquare, CheckCircle2, User, UserMinus, AtSign, ArrowRightLeft, Play, Hash, Mail, Briefcase, Building2, GitBranch, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useNotificationStore } from '../store/useNotificationStore';
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
import { Badge, type BadgeVariant } from '@/components/ui/badge';

import { Button } from '@/components/ui/button';


export const NotificationsInbox = () => {
  const { notifications, isLoading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
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

  const getIcon = (type: string): { icon: LucideIcon; variant: BadgeVariant; className?: string } => {
    switch (type) {
      case 'task_assigned': return { icon: User, variant: 'success' };
      case 'task_unassigned': return { icon: UserMinus, variant: 'destructive' };
      case 'task_commented': return { icon: MessageSquare, variant: 'success' };
      case 'task_mentioned': return { icon: AtSign, variant: 'outline', className: 'bg-primary-muted text-primary-on-muted border-primary-border' };
      case 'task_status_changed': return { icon: ArrowRightLeft, variant: 'warning' };
      case 'sprint_started': return { icon: Play, variant: 'success' };
      case 'sprint_closed': return { icon: CheckCircle2, variant: 'outline' };
      case 'channel_mentioned': return { icon: Hash, variant: 'outline', className: 'bg-primary-muted text-primary-on-muted border-primary-border' };
      case 'dm_received': return { icon: Mail, variant: 'outline', className: 'bg-primary-muted text-primary-on-muted border-primary-border' };
      case 'commit_linked': 
      case 'commit_unlinked': return { icon: GitBranch, variant: 'outline' };
      case 'ci_passed': return { icon: GitBranch, variant: 'success' };
      case 'ci_failed': return { icon: GitBranch, variant: 'destructive' };
      case 'project_member_added': return { icon: Briefcase, variant: 'success' };
      case 'workspace_invited': return { icon: Building2, variant: 'outline', className: 'bg-primary-muted text-primary-on-muted border-primary-border' };
      default: return { icon: Bell, variant: 'outline' };
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
    <div className="h-full overflow-y-auto p-8 font-sans bg-background text-foreground">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <h1 className="text-h1 font-[590] text-foreground">Inbox</h1>
            {localUnreadCount > 0 && (
              <span className="bg-danger text-danger-foreground text-caption font-[590] px-2 py-0.5 rounded-full">
                {localUnreadCount} new
              </span>
            )}
          </div>
          <Button 
            onClick={markAllRead}
            disabled={localUnreadCount === 0}
            variant="ghost"
            className="flex items-center text-ui font-[510] text-muted-foreground hover:text-foreground disabled:text-disabled transition-colors"
          >
            <Check className="w-4 h-4 mr-2" strokeWidth={1.75} />
            Mark all as read
          </Button>
        </div>

        {/* All / Unread Toggle + Type Filter */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex bg-card rounded-md border border-border overflow-hidden">
            <Button
              onClick={() => setViewMode('all')}
              variant="ghost"
              className={clsx("px-4 py-2 text-ui font-[510] transition-colors h-auto", viewMode === 'all' ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              All
            </Button>
            <Button
              onClick={() => setViewMode('unread')}
              variant="ghost"
              className={clsx("px-4 py-2 text-ui font-[510] transition-colors h-auto", viewMode === 'unread' ? "bg-hover text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Unread
            </Button>
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="bg-elevated">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="tasks">Tasks</SelectItem>
              <SelectItem value="sprints">Sprints</SelectItem>
              <SelectItem value="messages">Messages</SelectItem>
              <SelectItem value="github">GitHub</SelectItem>
              <SelectItem value="membership">Membership</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center text-subtle-foreground py-12">Loading...</div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm divide-y divide-border">
            {filtered.map(notif => {
              const { icon: Icon, variant, className } = getIcon(notif.type);
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
                    "flex items-start p-5 hover:bg-hover cursor-pointer transition-colors relative group",
                    !notif.isRead ? "bg-primary-muted" : ""
                  )}
                >
                  {!notif.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"></div>
                  )}
                  
                  <div className="mt-1 mr-4">
                    <Badge
                      variant={variant}
                      className={clsx("h-8 w-8 rounded-full px-0 py-0 border [&>svg]:!size-4", className)}
                    >
                      <Icon className="w-4 h-4" />
                    </Badge>
                  </div>

                  <div className="flex-1">
                    <p className={clsx("text-ui mb-1", !notif.isRead ? "text-foreground font-[590]" : "text-muted-foreground font-[510]")}>
                      {notif.title}
                    </p>
                    <span className="text-caption text-subtle-foreground">{notif.body}</span>
                  </div>

                  {!notif.isRead && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          onClick={(e) => { e.stopPropagation(); markRead(notif.notificationId); }}
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 p-1.5 text-subtle-foreground hover:text-foreground hover:bg-hover rounded transition-colors w-auto"
                          aria-label="Mark as read"
                        >
                          <Check className="w-4 h-4" strokeWidth={1.75} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Mark as read</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
            })}
            
            {filtered.length === 0 && (
              <div className="p-12 text-center text-subtle-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" strokeWidth={1.5} />
                <p>{viewMode === 'unread' ? 'Nothing unread right now.' : 'Nothing unread. New mentions and assignments will land here.'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
