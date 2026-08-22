import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, FileText, Hash, X, ChevronLeft, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { useCurrentWorkspaceStore } from '../store/currentWorkspace.js';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'dompurify';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskResult {
  type: 'task';
  taskId: string;
  taskKey: string;
  title: string;
  status: string;
  priority: string;
  issueType: string;
  createdAt: string;
  projectName: string;
  projectKey: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  snippet: string | null;
}

interface MessageResult {
  type: 'message';
  messageId: string;
  channelId: string;
  bodyText: string;
  createdAt: string;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
  channelName: string | null;
  snippet: string | null;
}

type FilterType = 'all' | 'tasks' | 'messages';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

// Domain mapping per design system §1.4, extended to cover the values the spec
// omits: `backlog` (coldest tier, one below todo) and the P0–P3 scale, which is
// an alias of urgent/high/medium/low rather than a second dimension.
const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground border border-border',
  todo: 'bg-muted text-muted-foreground border border-border',
  in_progress: 'bg-primary-muted text-primary border border-primary-border',
  in_review: 'bg-warning-muted text-warning border border-warning-border',
  done: 'bg-success-muted text-success border border-success-border',
};

const PRIORITY_INDICATORS: Record<string, string> = {
  urgent: 'bg-danger-muted text-danger border border-danger-border',
  critical: 'bg-danger-muted text-danger border border-danger-border',
  P0: 'bg-danger-muted text-danger border border-danger-border',
  high: 'bg-warning-muted text-warning border border-warning-border',
  P1: 'bg-warning-muted text-warning border border-warning-border',
  medium: 'bg-primary-muted text-primary border border-primary-border',
  P2: 'bg-primary-muted text-primary border border-primary-border',
  low: 'bg-muted text-muted-foreground border border-border',
  P3: 'bg-muted text-muted-foreground border border-border',
};

const RECENT_SEARCHES_KEY = 'devsync_recent_searches';

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  const recent = getRecentSearches().filter(s => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, 5)));
}

const ITEMS_PER_PAGE = 25;

// ─── Component ────────────────────────────────────────────────────────────────
export const GlobalSearchResults = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Results
  const [tasks, setTasks] = useState<TaskResult[]>([]);
  const [messages, setMessages] = useState<MessageResult[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssigneeId, setFilterAssigneeId] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterChannelId, setFilterChannelId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [page, setPage] = useState(0);

  // Data from workspace store for filter dropdowns
  const { projects, channels, members } = useCurrentWorkspaceStore();

  // All tab expansion
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false);

  // Skeleton delay timer ref
  const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query) {
        setSearchParams({ q: query });
      } else {
        setSearchParams({});
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, setSearchParams]);

  // Fetch results
  const fetchResults = useCallback(async () => {
    if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2 || !slug) {
      setTasks([]);
      setMessages([]);
      setTaskCount(0);
      setMessageCount(0);
      return;
    }

    setIsLoading(true);
    setShowSkeleton(false);
    // Show skeleton only after 200ms delay
    skeletonTimerRef.current = setTimeout(() => setShowSkeleton(true), 200);

    try {
      const params = new URLSearchParams({ q: debouncedQuery.trim() });
      if (filterType !== 'all') params.set('type', filterType);
      params.set('limit', String(ITEMS_PER_PAGE));
      params.set('offset', String(page * ITEMS_PER_PAGE));

      // Task filters
      if (filterProjectId) params.set('projectId', filterProjectId);
      if (filterStatus) params.set('status', filterStatus);
      if (filterAssigneeId) params.set('assigneeId', filterAssigneeId);
      if (filterPriority) params.set('priority', filterPriority);

      // Message filters
      if (filterChannelId) params.set('channelId', filterChannelId);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);

      const data = await apiFetch(`/workspaces/${slug}/search?${params.toString()}`);

      setTasks((data.tasks || []).map((t: Record<string, unknown>) => ({ ...t, type: 'task' as const } as unknown as TaskResult)));
      setMessages((data.messages || []).map((m: Record<string, unknown>) => ({ ...m, type: 'message' as const } as unknown as MessageResult)));
      setTaskCount(data.taskCount || 0);
      setMessageCount(data.messageCount || 0);

      // Save recent search
      addRecentSearch(debouncedQuery.trim());
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      clearTimeout(skeletonTimerRef.current);
      setIsLoading(false);
      setShowSkeleton(false);
    }
  }, [debouncedQuery, slug, filterType, page, filterProjectId, filterStatus, filterAssigneeId, filterPriority, filterChannelId, filterDateFrom, filterDateTo]);

  useEffect(() => {
    setTimeout(() => {
      fetchResults();
    }, 0);
  }, [fetchResults]);

  // Reset page when filters change
  const [prevFilters, setPrevFilters] = useState({ filterType, filterProjectId, filterStatus, filterAssigneeId, filterPriority, filterChannelId, filterDateFrom, filterDateTo });
  if (
    filterType !== prevFilters.filterType || filterProjectId !== prevFilters.filterProjectId ||
    filterStatus !== prevFilters.filterStatus || filterAssigneeId !== prevFilters.filterAssigneeId ||
    filterPriority !== prevFilters.filterPriority || filterChannelId !== prevFilters.filterChannelId ||
    filterDateFrom !== prevFilters.filterDateFrom || filterDateTo !== prevFilters.filterDateTo
  ) {
    setPrevFilters({ filterType, filterProjectId, filterStatus, filterAssigneeId, filterPriority, filterChannelId, filterDateFrom, filterDateTo });
    setPage(0);
    setShowAllTasks(false);
    setShowAllMessages(false);
  }

  const clearAllFilters = () => {
    setFilterProjectId('');
    setFilterStatus('');
    setFilterAssigneeId('');
    setFilterPriority('');
    setFilterChannelId('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasActiveFilters = filterProjectId || filterStatus || filterAssigneeId || filterPriority || filterChannelId || filterDateFrom || filterDateTo;

  const totalCount = taskCount + messageCount;
  const totalPages = filterType === 'all' ? 1 : Math.ceil((filterType === 'tasks' ? taskCount : messageCount) / ITEMS_PER_PAGE);

  // ─── Render Helpers ─────────────────────────────────────────────────────
  const renderTaskCard = (task: TaskResult) => (
    <div
      key={task.taskId}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/w/${slug}/projects/${task.projectKey}/tasks/${task.taskKey}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/w/${slug}/projects/${task.projectKey}/tasks/${task.taskKey}`);
        }
      }}
      className="group flex items-start p-4 bg-card border border-border rounded-lg hover:bg-hover hover:border-border-strong cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Task Key Badge */}
      <div className="mr-4 shrink-0 mt-0.5">
        <span className="inline-flex items-center px-2 py-1 text-[11px] font-mono font-bold text-foreground bg-secondary border border-border rounded-md">
          {task.taskKey}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1.5">
          <h4 className="text-body font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {task.title}
          </h4>
          {task.status && (
            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[task.status] || 'bg-muted text-muted-foreground border border-border'}`}>
              {task.status.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-subtle-foreground">
          <span className="font-medium text-muted-foreground">{task.projectName}</span>
          {task.assigneeName && (
            <>
              <span className="text-subtle-foreground">·</span>
              <span>assigned to <span className="text-muted-foreground">{task.assigneeName}</span></span>
            </>
          )}
          <span className="text-subtle-foreground">·</span>
          <span>{task.createdAt ? format(new Date(task.createdAt), 'MMM d, yyyy') : ''}</span>
          {task.priority && (
            <>
              <span className="text-subtle-foreground">·</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`inline-block w-2 h-2 rounded-full ${PRIORITY_INDICATORS[task.priority] || ''}`} />
                </TooltipTrigger>
                <TooltipContent>{task.priority}</TooltipContent>
              </Tooltip>
              <span className="capitalize">{task.priority}</span>
            </>
          )}
        </div>

        {/* Snippet */}
        {task.snippet && (
          <p
            className="mt-2 text-sm text-subtle-foreground line-clamp-2 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(task.snippet) }}
          />
        )}
      </div>
    </div>
  );

  const renderMessageCard = (msg: MessageResult) => (
    <div
      key={msg.messageId}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/w/${slug}/channels/${msg.channelId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/w/${slug}/channels/${msg.channelId}`);
        }
      }}
      className="group flex items-start p-4 bg-card border border-border rounded-lg hover:bg-hover hover:border-border-strong cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Avatar */}
      <div className="mr-4 shrink-0 mt-0.5">
        {msg.authorAvatar ? (
          <Avatar className="size-9 border border-border">
            <AvatarImage src={msg.authorAvatar} alt={msg.authorName || ''} />
          </Avatar>
        ) : (
          <Avatar className="size-9 border border-border">
            <AvatarFallback className="bg-secondary text-foreground text-xs font-bold">
              {msg.authorName?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-foreground">{msg.authorName || 'Unknown'}</span>
          <span className="text-xs text-subtle-foreground">in</span>
          <span className="text-xs text-muted-foreground flex items-center">
            <Hash className="w-3 h-3 mr-0.5 opacity-60" />
            {msg.channelName || 'unknown'}
          </span>
          <span className="text-subtle-foreground">·</span>
          <span className="text-xs text-subtle-foreground">
            {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : ''}
          </span>
        </div>

        <p
          className="text-sm text-muted-foreground line-clamp-2 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: `"${DOMPurify.sanitize(msg.snippet || msg.bodyText?.substring(0, 150) || '')}"` }}
        />
      </div>
    </div>
  );

  const renderSkeleton = (count: number) => (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start p-4 bg-card border border-border rounded-lg animate-pulse">
          <div className="w-16 h-7 rounded-md bg-muted mr-4 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  const recentSearches = getRecentSearches();

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col font-sans bg-background text-foreground">

      {/* ── Header with Search Input ─────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-5 border-b border-border bg-background shrink-0">
        <div className="max-w-4xl">
          <div className="relative">
            <Search className="w-5 h-5 text-subtle-foreground absolute left-4 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, messages..."
              className="w-full bg-card border border-border rounded-lg pl-12 pr-4 py-3.5 text-foreground focus:border-ring focus:ring-1 focus:ring-ring text-lg transition-all h-auto md:text-lg"
              autoFocus
            />
          </div>

          {/* Results count */}
          {debouncedQuery && !isLoading && (
            <p className="mt-3 text-sm text-subtle-foreground">
              <span className="text-foreground font-semibold">{totalCount}</span> results for "<span className="text-foreground">{debouncedQuery}</span>"
            </p>
          )}
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      {debouncedQuery && (
        <div className="px-8 py-3 border-b border-border bg-background/80 shrink-0">
          <div className="max-w-4xl flex flex-wrap items-center gap-2">
            {/* Type Tabs */}
            <div className="flex items-center bg-card rounded-lg border border-border p-0.5 mr-2">
              {([
                { key: 'all', label: 'All' },
                { key: 'tasks', label: `Tasks${taskCount ? ` (${taskCount})` : ''}` },
                { key: 'messages', label: `Messages${messageCount ? ` (${messageCount})` : ''}` },
              ] as const).map(tab => (
                <Button
                  key={tab.key}
                  onClick={() => setFilterType(tab.key)}
                  variant="ghost"
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all h-auto ${
                    filterType === tab.key
                      ? 'bg-secondary text-foreground shadow-sm'
                      : 'text-subtle-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Task Filters (shown when Tasks tab or All tab) */}
            {(filterType === 'tasks' || filterType === 'all') && (
              <>
                <Select value={filterProjectId} onValueChange={setFilterProjectId}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.projectId} value={p.projectId}>{p.name} ({p.key})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.filter(opt => opt.value).map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterAssigneeId} onValueChange={setFilterAssigneeId}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue placeholder="All Assignees" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m: { userId: string; fullName: string }) => (
                      <SelectItem key={m.userId} value={m.userId}>{m.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.filter(opt => opt.value).map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {/* Message Filters (shown when Messages tab) */}
            {filterType === 'messages' && (
              <>
                <Select value={filterChannelId} onValueChange={setFilterChannelId}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue placeholder="All Channels" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.filter(c => c.type !== 'dm' && c.type !== 'group_dm').map(c => (
                      <SelectItem key={c.channelId} value={c.channelId}>#{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5">
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:border-ring transition-colors cursor-pointer md:text-xs"
                    placeholder="From"
                  />
                  <span className="text-subtle-foreground text-xs">—</span>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:border-ring transition-colors cursor-pointer md:text-xs"
                    placeholder="To"
                  />
                </div>
              </>
            )}

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button
                onClick={clearAllFilters}
                variant="ghost"
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-subtle-foreground hover:text-foreground transition-colors h-auto"
              >
                <X className="w-3 h-3" />
                Clear filters
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Results Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl">

          {/* Loading state with delayed skeleton */}
          {isLoading && showSkeleton && renderSkeleton(4)}

          {/* No query state */}
          {!debouncedQuery && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              {recentSearches.length > 0 ? (
                <div className="w-full max-w-md">
                  <p className="text-[11px] font-semibold text-subtle-foreground uppercase tracking-wider mb-4">Recent Searches</p>
                  <div className="space-y-1">
                    {recentSearches.map((term, i) => (
                      <Button
                        key={i}
                        onClick={() => setQuery(term)}
                        variant="secondary"
                        className="w-full flex items-center px-4 py-3 rounded-lg text-sm text-foreground bg-card border border-border hover:bg-hover hover:border-border-strong transition-all group h-auto"
                      >
                        <Clock className="w-4 h-4 text-subtle-foreground mr-3 shrink-0" />
                        <span className="truncate">{term}</span>
                        <Search className="w-3.5 h-3.5 text-subtle-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Search className="w-12 h-12 text-subtle-foreground/40 mx-auto mb-4" />
                  <p className="text-subtle-foreground text-lg">Search across your workspace</p>
                  <p className="text-subtle-foreground text-sm mt-1">Find tasks, messages, and more</p>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {debouncedQuery && !isLoading && totalCount === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-lg bg-card border border-border flex items-center justify-center mb-5">
                <AlertCircle className="w-7 h-7 text-subtle-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No results for "{debouncedQuery}"</h3>
              <div className="space-y-1.5 text-sm text-subtle-foreground mt-2">
                <p>• Check your spelling</p>
                <p>• Try fewer or different keywords</p>
                <p>• Search is scoped to projects and channels you have access to</p>
              </div>
            </div>
          )}

          {/* Results — All Tab */}
          {debouncedQuery && !isLoading && filterType === 'all' && totalCount > 0 && (
            <div className="space-y-8">
              {/* Tasks Section */}
              {tasks.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-subtle-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Tasks
                    <span className="text-subtle-foreground font-normal">({taskCount})</span>
                  </h3>
                  <div className="space-y-2.5">
                    {(showAllTasks ? tasks : tasks.slice(0, 5)).map(renderTaskCard)}
                  </div>
                  {taskCount > 5 && !showAllTasks && (
                    <Button
                      onClick={() => { setFilterType('tasks'); setPage(0); }}
                      variant="ghost"
                      className="mt-3 text-sm text-primary hover:text-primary-hover transition-colors flex items-center gap-1 h-auto"
                    >
                      Show all {taskCount} tasks
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}

              {/* Messages Section */}
              {messages.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-subtle-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5" />
                    Messages
                    <span className="text-subtle-foreground font-normal">({messageCount})</span>
                  </h3>
                  <div className="space-y-2.5">
                    {(showAllMessages ? messages : messages.slice(0, 5)).map(renderMessageCard)}
                  </div>
                  {messageCount > 5 && !showAllMessages && (
                    <Button
                      onClick={() => { setFilterType('messages'); setPage(0); }}
                      variant="ghost"
                      className="mt-3 text-sm text-primary hover:text-primary-hover transition-colors flex items-center gap-1 h-auto"
                    >
                      Show all {messageCount} messages
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Results — Tasks Tab (paginated) */}
          {debouncedQuery && !isLoading && filterType === 'tasks' && (
            <div>
              <div className="space-y-2.5">
                {tasks.map(renderTaskCard)}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <Button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    variant="ghost"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors h-auto"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Button>
                  <span className="text-xs text-subtle-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    variant="ghost"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors h-auto"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Results — Messages Tab (paginated) */}
          {debouncedQuery && !isLoading && filterType === 'messages' && (
            <div>
              <div className="space-y-2.5">
                {messages.map(renderMessageCard)}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <Button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    variant="ghost"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors h-auto"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Button>
                  <span className="text-xs text-subtle-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    variant="ghost"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors h-auto"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
