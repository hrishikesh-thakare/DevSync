import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const itemClass =
  'flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer ' +
  'aria-selected:bg-accent aria-selected:text-accent-foreground ' +
  'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground';

const groupClass =
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 ' +
  '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold ' +
  '[&_[cmdk-group-heading]]:text-muted-foreground';

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
        return;
      }
      // Escape is Radix Dialog's job now — handling it here as well would
      // close the palette twice over.
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
    // Radix Dialog rather than a bare overlay div: this was previously a plain
    // <div> with a click handler, so it had no role="dialog", no aria-modal, no
    // focus trap (Tab escaped to the page behind it) and no focus restore on
    // close. Radix provides all four, plus Escape handling.
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closePalette())}>
      <DialogContent
        showCloseButton={false}
        aria-label="Command menu"
        className="top-[15vh] max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command menu</DialogTitle>
          <DialogDescription>
            Search tasks, messages, projects and channels, or jump to a page.
          </DialogDescription>
        </DialogHeader>

        <Command label="Global Command Menu" shouldFilter={false} loop>
          <div className="flex items-center gap-2 border-b px-4">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={slug ? 'Search tasks, messages, projects…' : 'Type a command…'}
              className="flex h-14 w-full bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Command.List className="max-h-[320px] overflow-x-hidden overflow-y-auto p-2">
            {!hasResults && !isSearching ? (
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                {trimmed.length >= MIN_QUERY
                  ? 'No results found.'
                  : 'Type at least two characters to search.'}
              </Command.Empty>
            ) : null}

            {isSearching && !hasResults ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>
            ) : null}

            {matches.projects.length > 0 ? (
              <Command.Group heading="Projects" className={groupClass}>
                {matches.projects.map((project) => (
                  <Command.Item
                    key={project.projectId}
                    value={`project-${project.projectId}`}
                    onSelect={() => run(() => navigate(`/w/${slug}/projects/${project.key}`))}
                    className={itemClass}
                  >
                    <FolderKanbanIcon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{project.name}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {project.key}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {matches.channels.length > 0 ? (
              <Command.Group heading="Channels" className={groupClass}>
                {matches.channels.map((channel) => (
                  <Command.Item
                    key={channel.channelId}
                    value={`channel-${channel.channelId}`}
                    onSelect={() => run(() => navigate(`/w/${slug}/channels/${channel.channelId}`))}
                    className={itemClass}
                  >
                    <HashIcon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{channel.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {tasks.length > 0 ? (
              <Command.Group heading="Tasks" className={groupClass}>
                {tasks.map((task) => (
                  <Command.Item
                    key={task.taskId}
                    value={`task-${task.taskId}`}
                    onSelect={() =>
                      run(() =>
                        navigate(`/w/${slug}/projects/${task.projectKey}/tasks/${task.taskKey}`),
                      )
                    }
                    className={itemClass}
                  >
                    <span className="shrink-0 text-muted-foreground" aria-hidden="true">
                      {ISSUE_TYPE_META[task.issueType]?.glyph ?? '■'}
                    </span>
                    <span className="truncate">{task.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                      {task.taskKey}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {messages.length > 0 ? (
              <Command.Group heading="Messages" className={groupClass}>
                {messages.map((message) => (
                  <Command.Item
                    key={message.messageId}
                    value={`message-${message.messageId}`}
                    onSelect={() =>
                      run(() =>
                        navigate(
                          `/w/${slug}/channels/${message.channelId}?messageId=${message.messageId}`,
                        ),
                      )
                    }
                    className={itemClass}
                  >
                    <HashIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{message.bodyText}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {message.authorName ?? 'Unknown'}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            <Command.Group heading="Go to" className={`mt-2 ${groupClass}`}>
              {slug && trimmed.length >= MIN_QUERY ? (
                <Command.Item
                  value="see-all-results"
                  onSelect={() =>
                    run(() => navigate(`/w/${slug}/search?q=${encodeURIComponent(trimmed)}`))
                  }
                  className={itemClass}
                >
                  <SearchIcon className="size-4" aria-hidden="true" />
                  <span>
                    See all results for &ldquo;{trimmed}&rdquo;
                  </span>
                </Command.Item>
              ) : null}

              {slug && matches.hit('my tasks') ? (
                <Command.Item
                  value="nav-my-tasks"
                  onSelect={() => run(() => navigate(`/w/${slug}/my-tasks`))}
                  className={itemClass}
                >
                  <CheckSquareIcon className="size-4" aria-hidden="true" />
                  <span>My Tasks</span>
                </Command.Item>
              ) : null}

              {slug && matches.hit('members') ? (
                <Command.Item
                  value="nav-members"
                  onSelect={() => run(() => navigate(`/w/${slug}/members`))}
                  className={itemClass}
                >
                  <UsersIcon className="size-4" aria-hidden="true" />
                  <span>Members</span>
                </Command.Item>
              ) : null}

              {matches.hit('workspaces') ? (
                <Command.Item
                  value="nav-workspaces"
                  onSelect={() => run(() => navigate('/workspaces'))}
                  className={itemClass}
                >
                  <FolderKanbanIcon className="size-4" aria-hidden="true" />
                  <span>Workspaces</span>
                </Command.Item>
              ) : null}

              {matches.hit('account settings') ? (
                <Command.Item
                  value="nav-account"
                  onSelect={() => run(() => navigate('/account'))}
                  className={itemClass}
                >
                  <SettingsIcon className="size-4" aria-hidden="true" />
                  <span>Account Settings</span>
                </Command.Item>
              ) : null}
            </Command.Group>

            {matches.hit('log out') ? (
              <Command.Group heading="Actions" className={`mt-2 ${groupClass}`}>
                <Command.Item
                  value="action-logout"
                  onSelect={() =>
                    run(() => {
                      logout();
                      navigate('/login');
                    })
                  }
                  className={`${itemClass} text-destructive data-[selected=true]:text-destructive`}
                >
                  <LogOutIcon className="size-4" aria-hidden="true" />
                  <span>Log out</span>
                </Command.Item>
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
