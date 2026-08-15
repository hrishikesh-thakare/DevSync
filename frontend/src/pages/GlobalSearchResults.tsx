import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, FileText, Hash, X, ChevronLeft, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { useCurrentWorkspaceStore } from '../store/currentWorkspace.js';
import { formatDistanceToNow, format } from 'date-fns';
import DOMPurify from 'dompurify';

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

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-700 text-gray-300',
  in_progress: 'bg-white/15 text-white border border-white/30',
  in_review: 'bg-white/10 text-gray-300 border border-white/20',
  done: 'bg-white/20 text-white border border-white',
};

const PRIORITY_INDICATORS: Record<string, string> = {
  critical: 'bg-white text-black',
  high: 'bg-white/40 text-white',
  medium: 'bg-white/20 text-gray-300',
  low: 'bg-white/10 text-gray-500',
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
      onClick={() => navigate(`/w/${slug}/projects/${task.projectKey}/tasks/${task.taskKey}`)}
      className="group flex items-start p-4 bg-gray-900/50 border border-gray-800/60 rounded-xl hover:bg-gray-800/50 hover:border-gray-700/60 cursor-pointer transition-all duration-200"
    >
      {/* Task Key Badge */}
      <div className="mr-4 shrink-0 mt-0.5">
        <span className="inline-flex items-center px-2 py-1 text-[11px] font-mono font-bold text-gray-300 bg-gray-800 border border-gray-700 rounded-md">
          {task.taskKey}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1.5">
          <h4 className="text-[15px] font-semibold text-gray-200 group-hover:text-white transition-colors truncate">
            {task.title}
          </h4>
          {task.status && (
            <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[task.status] || 'bg-gray-800 text-gray-400'}`}>
              {task.status.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-gray-400">{task.projectName}</span>
          {task.assigneeName && (
            <>
              <span className="text-gray-700">·</span>
              <span>assigned to <span className="text-gray-400">{task.assigneeName}</span></span>
            </>
          )}
          <span className="text-gray-700">·</span>
          <span>{task.createdAt ? format(new Date(task.createdAt), 'MMM d, yyyy') : ''}</span>
          {task.priority && (
            <>
              <span className="text-gray-700">·</span>
              <span className={`inline-block w-2 h-2 rounded-full ${PRIORITY_INDICATORS[task.priority] || ''}`} title={task.priority} />
              <span className="capitalize">{task.priority}</span>
            </>
          )}
        </div>

        {/* Snippet */}
        {task.snippet && (
          <p
            className="mt-2 text-sm text-gray-500 line-clamp-2 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(task.snippet) }}
          />
        )}
      </div>
    </div>
  );

  const renderMessageCard = (msg: MessageResult) => (
    <div
      key={msg.messageId}
      onClick={() => navigate(`/w/${slug}/channels/${msg.channelId}`)}
      className="group flex items-start p-4 bg-gray-900/50 border border-gray-800/60 rounded-xl hover:bg-gray-800/50 hover:border-gray-700/60 cursor-pointer transition-all duration-200"
    >
      {/* Avatar */}
      <div className="mr-4 shrink-0 mt-0.5">
        {msg.authorAvatar ? (
          <img src={msg.authorAvatar} alt={msg.authorName || ''} className="w-9 h-9 rounded-full border border-gray-700" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-white text-xs font-bold border border-gray-700">
            {msg.authorName?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-300">{msg.authorName || 'Unknown'}</span>
          <span className="text-xs text-gray-600">in</span>
          <span className="text-xs text-gray-400 flex items-center">
            <Hash className="w-3 h-3 mr-0.5 opacity-60" />
            {msg.channelName || 'unknown'}
          </span>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-600">
            {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : ''}
          </span>
        </div>

        <p
          className="text-sm text-gray-400 line-clamp-2 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: `"${DOMPurify.sanitize(msg.snippet || msg.bodyText?.substring(0, 150) || '')}"` }}
        />
      </div>
    </div>
  );

  const renderSkeleton = (count: number) => (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-start p-4 bg-gray-900/40 border border-gray-800/60 rounded-xl animate-pulse">
          <div className="w-16 h-7 rounded-md bg-gray-800 mr-4 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 bg-gray-800 rounded w-2/3" />
            <div className="h-3 bg-gray-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  const recentSearches = getRecentSearches();

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col font-sans bg-gray-950 text-gray-200">

      {/* ── Header with Search Input ─────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-5 border-b border-gray-800/60 bg-gray-950 shrink-0">
        <div className="max-w-4xl">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, messages..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-12 pr-4 py-3.5 text-gray-100 focus:outline-none focus:border-gray-600 focus:ring-1 focus:ring-gray-600 text-lg transition-all"
              autoFocus
            />
          </div>

          {/* Results count */}
          {debouncedQuery && !isLoading && (
            <p className="mt-3 text-sm text-gray-500">
              <span className="text-gray-300 font-semibold">{totalCount}</span> results for "<span className="text-gray-300">{debouncedQuery}</span>"
            </p>
          )}
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      {debouncedQuery && (
        <div className="px-8 py-3 border-b border-gray-800/40 bg-gray-950/80 shrink-0">
          <div className="max-w-4xl flex flex-wrap items-center gap-2">
            {/* Type Tabs */}
            <div className="flex items-center bg-gray-900 rounded-lg border border-gray-800 p-0.5 mr-2">
              {([
                { key: 'all', label: 'All' },
                { key: 'tasks', label: `Tasks${taskCount ? ` (${taskCount})` : ''}` },
                { key: 'messages', label: `Messages${messageCount ? ` (${messageCount})` : ''}` },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterType(tab.key)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    filterType === tab.key
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Task Filters (shown when Tasks tab or All tab) */}
            {(filterType === 'tasks' || filterType === 'all') && (
              <>
                <select
                  value={filterProjectId}
                  onChange={e => setFilterProjectId(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                >
                  <option value="">All Projects</option>
                  {projects.map(p => (
                    <option key={p.projectId} value={p.projectId}>{p.name} ({p.key})</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <select
                  value={filterAssigneeId}
                  onChange={e => setFilterAssigneeId(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                >
                  <option value="">All Assignees</option>
                  {members.map((m: { userId: string; fullName: string }) => (
                    <option key={m.userId} value={m.userId}>{m.fullName}</option>
                  ))}
                </select>

                <select
                  value={filterPriority}
                  onChange={e => setFilterPriority(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                >
                  {PRIORITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </>
            )}

            {/* Message Filters (shown when Messages tab) */}
            {filterType === 'messages' && (
              <>
                <select
                  value={filterChannelId}
                  onChange={e => setFilterChannelId(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                >
                  <option value="">All Channels</option>
                  {channels.filter(c => c.type !== 'dm' && c.type !== 'group_dm').map(c => (
                    <option key={c.channelId} value={c.channelId}>#{c.name}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                    placeholder="From"
                  />
                  <span className="text-gray-600 text-xs">—</span>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                    placeholder="To"
                  />
                </div>
              </>
            )}

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Results Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-4xl">

          {/* Loading state with delayed skeleton */}
          {isLoading && showSkeleton && renderSkeleton(4)}

          {/* No query state */}
          {!debouncedQuery && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              {recentSearches.length > 0 ? (
                <div className="w-full max-w-md">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Searches</p>
                  <div className="space-y-1">
                    {recentSearches.map((term, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(term)}
                        className="w-full flex items-center px-4 py-3 rounded-xl text-sm text-gray-300 bg-gray-900/40 border border-gray-800/60 hover:bg-gray-800/50 hover:border-gray-700/60 transition-all group"
                      >
                        <Clock className="w-4 h-4 text-gray-600 mr-3 shrink-0" />
                        <span className="truncate">{term}</span>
                        <Search className="w-3.5 h-3.5 text-gray-700 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Search className="w-12 h-12 text-gray-800 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Search across your workspace</p>
                  <p className="text-gray-600 text-sm mt-1">Find tasks, messages, and more</p>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {debouncedQuery && !isLoading && totalCount === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-5">
                <AlertCircle className="w-7 h-7 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">No results for "{debouncedQuery}"</h3>
              <div className="space-y-1.5 text-sm text-gray-500 mt-2">
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
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Tasks
                    <span className="text-gray-600 font-normal">({taskCount})</span>
                  </h3>
                  <div className="space-y-2.5">
                    {(showAllTasks ? tasks : tasks.slice(0, 5)).map(renderTaskCard)}
                  </div>
                  {taskCount > 5 && !showAllTasks && (
                    <button
                      onClick={() => { setFilterType('tasks'); setPage(0); }}
                      className="mt-3 text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
                    >
                      Show all {taskCount} tasks
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Messages Section */}
              {messages.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5" />
                    Messages
                    <span className="text-gray-600 font-normal">({messageCount})</span>
                  </h3>
                  <div className="space-y-2.5">
                    {(showAllMessages ? messages : messages.slice(0, 5)).map(renderMessageCard)}
                  </div>
                  {messageCount > 5 && !showAllMessages && (
                    <button
                      onClick={() => { setFilterType('messages'); setPage(0); }}
                      className="mt-3 text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
                    >
                      Show all {messageCount} messages
                      <ChevronRight className="w-4 h-4" />
                    </button>
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
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800/60">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
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
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800/60">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
