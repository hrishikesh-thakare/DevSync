import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, FileText, Hash, ArrowRight, Clock, CornerDownLeft, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { formatDistanceToNow } from 'date-fns';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

interface TaskResult {
  type: 'task';
  taskId: string;
  taskKey: string;
  title: string;
  status: string;
  projectKey: string;
  projectName: string;
}

interface MessageResult {
  type: 'message';
  messageId: string;
  channelId: string;
  bodyText: string;
  channelName: string;
  authorName: string;
  createdAt: string;
}

type SearchResult = TaskResult | MessageResult;

interface SearchApiTask {
  taskId: string;
  taskKey: string;
  title: string;
  status: string;
  projectKey: string;
  projectName: string;
}

interface SearchApiMessage {
  messageId: string;
  channelId: string;
  bodyText: string;
  channelName: string;
  authorName: string;
  createdAt: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export const CommandPalette = ({ isOpen, onClose }: CommandPaletteProps) => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches] = useState(getRecentSearches);

  // Reset state each time the palette opens (cmdk keeps its own input focus).
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Debounced server-side search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2 || !slug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await apiFetch(`/workspaces/${slug}/search?q=${encodeURIComponent(query.trim())}&limit=5`);
        const combined: SearchResult[] = [
          ...(data.tasks || []).map((t: SearchApiTask) => ({ ...t, type: 'task' as const })),
          ...(data.messages || []).map((m: SearchApiMessage) => ({ ...m, type: 'message' as const })),
        ];
        setResults(combined);
      } catch (err) {
        console.error('Command palette search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, slug]);

  const navigateToResult = useCallback((result: SearchResult) => {
    addRecentSearch(query);
    onClose();
    if (result.type === 'task') {
      navigate(`/w/${slug}/projects/${result.projectKey}/tasks/${result.taskKey}`);
    } else {
      navigate(`/w/${slug}/channels/${result.channelId}`);
    }
  }, [slug, navigate, onClose, query]);

  const handleViewAll = useCallback(() => {
    const q = query.trim();
    if (q) {
      addRecentSearch(q);
      onClose();
      navigate(`/w/${slug}/search?q=${encodeURIComponent(q)}`);
    }
  }, [slug, navigate, onClose, query]);

  const handleRecentClick = useCallback((term: string) => {
    onClose();
    navigate(`/w/${slug}/search?q=${encodeURIComponent(term)}`);
  }, [slug, navigate, onClose]);

  const taskResults = results.filter(r => r.type === 'task') as TaskResult[];
  const messageResults = results.filter(r => r.type === 'message') as MessageResult[];

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      className="sm:max-w-2xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search tasks, messages..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="px-5 py-6 flex items-center justify-center gap-2 text-ui text-subtle-foreground">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
              Searching...
            </div>
          )}

          {!query.trim() && !isLoading && (
            <CommandGroup heading="Recent Searches">
              {recentSearches.length > 0 ? (
                recentSearches.map(term => (
                  <CommandItem key={term} value={term} onSelect={() => handleRecentClick(term)}>
                    <Clock className="w-4 h-4 text-subtle-foreground" strokeWidth={1.75} />
                    <span className="truncate">{term}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-subtle-foreground ml-auto" strokeWidth={1.75} />
                  </CommandItem>
                ))
              ) : (
                <CommandEmpty>Type to search across tasks and messages</CommandEmpty>
              )}
            </CommandGroup>
          )}

          {query.trim().length >= 2 && !isLoading && results.length === 0 && (
            <CommandEmpty>
              <Search className="w-8 h-8 text-subtle-foreground mx-auto mb-3" strokeWidth={1.5} />
              <p>No results for "{query}"</p>
              <p className="text-caption text-subtle-foreground mt-1">Try fewer or different keywords</p>
            </CommandEmpty>
          )}

          {!isLoading && results.length > 0 && (
            <>
              {taskResults.length > 0 && (
                <CommandGroup heading="Tasks">
                  {taskResults.map(task => (
                    <CommandItem key={task.taskId} value={`task-${task.taskId}`} onSelect={() => navigateToResult(task)}>
                      <FileText className="w-4 h-4 text-subtle-foreground" strokeWidth={1.75} />
                      <span className="text-micro font-mono text-subtle-foreground shrink-0">{task.taskKey}</span>
                      <span className="text-ui text-foreground truncate flex-1">{task.title}</span>
                      <span className="text-micro text-subtle-foreground font-mono ml-3 shrink-0">{task.projectKey}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {messageResults.length > 0 && (
                <CommandGroup heading="Messages">
                  {messageResults.map(msg => (
                    <CommandItem key={msg.messageId} value={`msg-${msg.messageId}`} onSelect={() => navigateToResult(msg)}>
                      <Hash className="w-4 h-4 text-subtle-foreground" strokeWidth={1.75} />
                      <span className="text-micro text-subtle-foreground shrink-0">#{msg.channelName}</span>
                      <span className="text-ui text-foreground truncate flex-1">{msg.bodyText?.substring(0, 80)}</span>
                      {msg.createdAt && (
                        <span className="text-micro text-subtle-foreground ml-3 shrink-0">
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandSeparator />
              <CommandGroup>
                <CommandItem value="__view_all__" onSelect={handleViewAll}>
                  <Search className="w-4 h-4" strokeWidth={1.75} />
                  View all results for "{query}"
                  <CornerDownLeft className="w-3.5 h-3.5 ml-auto" strokeWidth={1.75} />
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
};