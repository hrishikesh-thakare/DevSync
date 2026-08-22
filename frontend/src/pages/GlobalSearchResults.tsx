import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { HashIcon, SearchIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { apiFetch } from '@/lib/api';
import { renderSnippet } from '@/lib/highlight';
import { STATUS_META, PRIORITY_META } from '@/lib/taskMeta';
import { cn } from '@/lib/utils';

interface TaskHit {
  type: 'task';
  taskId: string;
  taskKey: string;
  title: string;
  status: keyof typeof STATUS_META;
  priority: keyof typeof PRIORITY_META;
  createdAt: string;
  projectName: string;
  projectKey: string;
  assigneeName: string | null;
  snippet: string | null;
}

interface MessageHit {
  type: 'message';
  messageId: string;
  channelId: string;
  bodyText: string;
  createdAt: string;
  authorName: string | null;
  channelName: string | null;
  snippet: string | null;
}

export function GlobalSearchResults() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const type = (params.get('type') ?? 'all') as 'all' | 'tasks' | 'messages';

  const [input, setInput] = useState(query);
  const [tasks, setTasks] = useState<TaskHit[]>([]);
  const [messages, setMessages] = useState<MessageHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (q: string, kind: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiFetch(
          `/workspaces/${slug}/search?q=${encodeURIComponent(q.trim())}&type=${kind}`,
        );
        setTasks(data.tasks ?? []);
        setMessages(data.messages ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed.');
        setTasks([]);
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    // The endpoint rejects anything under two characters with a 400, so short
    // queries never go out; the empty state for them is derived during render.
    if (query.trim().length < 2) return;
    // Fetching when the URL query changes is the "synchronise with an external
    // system" case the rule exists to permit. It still fires because the
    // request flips loading state on its first tick, before any await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run(query, type);
  }, [query, type, run]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ q: input, type });
  };

  const total = tasks.length + messages.length;

  return (
    <PageShell>
      <PageHeader title="Search" description="Full-text search across tasks and messages." />

      <form onSubmit={submit} className="mb-4 flex gap-2" role="search">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search tasks and messages…"
            aria-label="Search query"
            className="pl-8"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <Tabs value={type} onValueChange={(v) => setParams({ q: query, type: v })} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : query.trim().length < 2 ? (
        <Empty className="rounded-2xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Search this workspace</EmptyTitle>
            <EmptyDescription>Type at least two characters to begin.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : total === 0 ? (
        <Empty className="rounded-2xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No matches for “{query}”</EmptyTitle>
            <EmptyDescription>Try a different word, or search a broader type.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-6">
          {tasks.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Tasks ({tasks.length})
              </h2>
              <Card>
                <CardContent className="px-0">
                  <ul className="divide-y">
                    {tasks.map((t) => (
                      <li key={t.taskId}>
                        <Link
                          to={`/w/${slug}/projects/${t.projectKey}/tasks/${t.taskKey}`}
                          className="block px-4 py-3 transition-colors hover:bg-accent/50"
                        >
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{t.taskKey}</span>
                            <span className="text-sm text-foreground">{t.title}</span>
                          </p>
                          {t.snippet ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {renderSnippet(t.snippet)}
                            </p>
                          ) : null}
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{t.projectName}</Badge>
                            <Badge variant="outline">{STATUS_META[t.status]?.label ?? t.status}</Badge>
                            <span className={cn(PRIORITY_META[t.priority]?.text)}>
                              {PRIORITY_META[t.priority]?.label}
                            </span>
                            {t.assigneeName ? <span>· {t.assigneeName}</span> : null}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ) : null}

          {messages.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Messages ({messages.length})
              </h2>
              <Card>
                <CardContent className="px-0">
                  <ul className="divide-y">
                    {messages.map((m) => (
                      <li key={m.messageId}>
                        <Link
                          to={`/w/${slug}/channels/${m.channelId}?messageId=${m.messageId}`}
                          className="block px-4 py-3 transition-colors hover:bg-accent/50"
                        >
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <HashIcon className="size-3.5" aria-hidden="true" />
                            {m.channelName ?? 'channel'} · {m.authorName ?? 'Unknown'} ·{' '}
                            {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                          </p>
                          <p className="mt-1 text-sm text-foreground">
                            {m.snippet ? renderSnippet(m.snippet) : m.bodyText}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
