import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquareIcon,
  FolderKanbanIcon,
  HashIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useAuthStore } from '@/store/auth';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { apiFetch } from '@/lib/api';
import { ISSUE_TYPE_META } from '@/lib/taskMeta';

/** The search endpoint 400s below two characters, so nothing shorter goes out. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 200;

interface TaskHit {
  taskId: string;
  taskKey: string;
  title: string;
  issueType: keyof typeof ISSUE_TYPE_META;
  projectKey: string;
  projectName: string;
}

interface MessageHit {
  messageId: string;
  channelId: string;
  channelName: string | null;
  authorName: string | null;
  bodyText: string;
}

interface Results {
  /** The trimmed query these hits answer, so stale ones are never displayed. */
  q: string;
  tasks: TaskHit[];
  messages: MessageHit[];
}

const NO_RESULTS: Results = { q: '', tasks: [], messages: [] };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>(NO_RESULTS);

  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { slug, projects, channels } = useCurrentWorkspaceStore();

  // Guards against a slow early request overwriting a newer one's results.
  const requestSeq = useRef(0);

  const trimmed = query.trim();
  const shouldSearch = open && Boolean(slug) && trimmed.length >= MIN_QUERY;

  // Results are shown only while they answer the query on screen. Deriving this
  // rather than clearing state on every keystroke keeps the effect below free
  // of synchronous setState, and removes the stale-hit flash entirely.
  const isFresh = shouldSearch && results.q === trimmed;
  const tasks = isFresh ? results.tasks : [];
  const messages = isFresh ? results.messages : [];
  const isSearching = shouldSearch && !isFresh;

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults(NO_RESULTS);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (open) closePalette();
        else setOpen(true);
      }
      // Escape is Radix Dialog's job (via CommandDialog) — handling it here
      // too would close the palette twice over.
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, closePalette]);

  useEffect(() => {
    if (!shouldSearch) return;

    const seq = ++requestSeq.current;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const data = await apiFetch(
            `/workspaces/${slug}/search?q=${encodeURIComponent(trimmed)}&type=all&limit=5`,
          );
          if (seq !== requestSeq.current) return;
          setResults({ q: trimmed, tasks: data.tasks ?? [], messages: data.messages ?? [] });
        } catch {
          if (seq !== requestSeq.current) return;
          // A failed lookup should not blank the palette — the static
          // navigation entries below still work without the server.
          setResults({ q: trimmed, tasks: [], messages: [] });
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [shouldSearch, slug, trimmed]);

  // Server hits are already ranked, so cmdk's own filter is off and the static
  // entries are matched here instead.
  const matches = useMemo(() => {
    const needle = trimmed.toLowerCase();
    const hit = (text: string) => !needle || text.toLowerCase().includes(needle);
    return {
      projects: projects.filter((p) => hit(p.name) || hit(p.key)).slice(0, 5),
      channels: channels.filter((c) => hit(c.name)).slice(0, 5),
      hit,
    };
  }, [projects, channels, trimmed]);

  const run = (action: () => void) => {
    closePalette();
    action();
  };

  const hasResults =
    tasks.length > 0 ||
    messages.length > 0 ||
    matches.projects.length > 0 ||
    matches.channels.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : closePalette())}
      title="Command menu"
      description="Search tasks, messages, projects and channels, or jump to a page."
    >
      <Command label="Global Command Menu" shouldFilter={false} loop>
        <CommandInput
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={slug ? 'Search tasks, messages, projects…' : 'Type a command…'}
        />

        <CommandList>
          {!hasResults && !isSearching ? (
            <CommandEmpty>
              {trimmed.length >= MIN_QUERY
                ? 'No results found.'
                : 'Type at least two characters to search.'}
            </CommandEmpty>
          ) : null}

          {isSearching && !hasResults ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>
          ) : null}

          {matches.projects.length > 0 ? (
            <CommandGroup heading="Projects">
              {matches.projects.map((project) => (
                <CommandItem
                  key={project.projectId}
                  value={`project-${project.projectId}`}
                  onSelect={() => run(() => navigate(`/w/${slug}/projects/${project.key}`))}
                >
                  <FolderKanbanIcon aria-hidden="true" />
                  <span className="truncate">{project.name}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {project.key}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {matches.channels.length > 0 ? (
            <CommandGroup heading="Channels">
              {matches.channels.map((channel) => (
                <CommandItem
                  key={channel.channelId}
                  value={`channel-${channel.channelId}`}
                  onSelect={() => run(() => navigate(`/w/${slug}/channels/${channel.channelId}`))}
                >
                  <HashIcon aria-hidden="true" />
                  <span className="truncate">{channel.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {tasks.length > 0 ? (
            <CommandGroup heading="Tasks">
              {tasks.map((task) => (
                <CommandItem
                  key={task.taskId}
                  value={`task-${task.taskId}`}
                  onSelect={() =>
                    run(() =>
                      navigate(`/w/${slug}/projects/${task.projectKey}/tasks/${task.taskKey}`),
                    )
                  }
                >
                  <span className="shrink-0 text-muted-foreground" aria-hidden="true">
                    {ISSUE_TYPE_META[task.issueType]?.glyph ?? '■'}
                  </span>
                  <span className="truncate">{task.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                    {task.taskKey}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {messages.length > 0 ? (
            <CommandGroup heading="Messages">
              {messages.map((message) => (
                <CommandItem
                  key={message.messageId}
                  value={`message-${message.messageId}`}
                  onSelect={() =>
                    run(() =>
                      navigate(
                        `/w/${slug}/channels/${message.channelId}?messageId=${message.messageId}`,
                      ),
                    )
                  }
                >
                  <HashIcon aria-hidden="true" />
                  <span className="truncate">{message.bodyText}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {message.authorName ?? 'Unknown'}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          <CommandGroup heading="Go to">
            {slug && trimmed.length >= MIN_QUERY ? (
              <CommandItem
                value="see-all-results"
                onSelect={() =>
                  run(() => navigate(`/w/${slug}/search?q=${encodeURIComponent(trimmed)}`))
                }
              >
                <SearchIcon aria-hidden="true" />
                <span>See all results for &ldquo;{trimmed}&rdquo;</span>
              </CommandItem>
            ) : null}

            {slug && matches.hit('my tasks') ? (
              <CommandItem value="nav-my-tasks" onSelect={() => run(() => navigate(`/w/${slug}/my-tasks`))}>
                <CheckSquareIcon aria-hidden="true" />
                <span>My Tasks</span>
              </CommandItem>
            ) : null}

            {slug && matches.hit('members') ? (
              <CommandItem value="nav-members" onSelect={() => run(() => navigate(`/w/${slug}/members`))}>
                <UsersIcon aria-hidden="true" />
                <span>Members</span>
              </CommandItem>
            ) : null}

            {matches.hit('workspaces') ? (
              <CommandItem value="nav-workspaces" onSelect={() => run(() => navigate('/workspaces'))}>
                <FolderKanbanIcon aria-hidden="true" />
                <span>Workspaces</span>
              </CommandItem>
            ) : null}

            {matches.hit('account settings') ? (
              <CommandItem value="nav-account" onSelect={() => run(() => navigate('/account'))}>
                <SettingsIcon aria-hidden="true" />
                <span>Account Settings</span>
              </CommandItem>
            ) : null}
          </CommandGroup>

          {matches.hit('log out') ? (
            <CommandGroup heading="Actions">
              <CommandItem
                value="action-logout"
                className="text-destructive data-selected:text-destructive"
                onSelect={() =>
                  run(() => {
                    logout();
                    navigate('/login');
                  })
                }
              >
                <LogOutIcon aria-hidden="true" />
                <span>Log out</span>
              </CommandItem>
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
