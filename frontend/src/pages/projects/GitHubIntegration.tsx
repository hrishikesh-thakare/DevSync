import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  CheckCircle2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  CircleDashedIcon,
  CircleSlashIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  GitPullRequestIcon,
  LockIcon,
  Loader2Icon,
  MessageSquareIcon,
  RefreshCwIcon,
  Rows2Icon,
  Rows3Icon,
  SparklesIcon,
  XCircleIcon,
} from 'lucide-react';

import { EmptyState, ErrorState } from '@/components/layout/PageState';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { GithubRepoOption } from '@/types/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { useGithubStore, type GithubTab } from '@/store/githubStore';
import { useMyProjectRole } from '@/store/projectStore';
import { cn } from '@/lib/utils';

const TABS: { value: GithubTab; label: string }[] = [
  { value: 'commits', label: 'Commits' },
  { value: 'ci', label: 'CI runs' },
  { value: 'prs', label: 'Pull requests' },
  { value: 'issues', label: 'Issues' },
  { value: 'branches', label: 'Branches' },
];

export function GitHubIntegration() {
  const { slug = '', key = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const myUserId = useAuthStore((s) => s.user?.userId);
  const myRole = useMyProjectRole();
  const canConnect = myRole === 'project_admin';
  const canRerun = myRole === 'project_admin' || myRole === 'developer';
  const [dmBusyFor, setDmBusyFor] = useState<string | null>(null);

  // Same dedup-by-membership DM as WorkspaceMembersPage: repeat clicks land
  // in the one existing conversation rather than spawning new ones.
  const messageCommitAuthor = async (userId: string) => {
    setDmBusyFor(userId);
    try {
      const data = await apiFetch(`/workspaces/${slug}/channels`, {
        method: 'POST',
        body: JSON.stringify({ type: 'dm', memberIds: [userId] }),
      });
      navigate(`/w/${slug}/channels/${data.channel.channelId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start the conversation.');
    } finally {
      setDmBusyFor(null);
    }
  };

  const {
    connection,
    branchOptions,
    isLoadingConnection,
    connectionError,
    commits,
    ciRuns,
    pullRequests,
    issues,
    branches,
    isLoadingTab,
    tabError,
    fetchConnection,
    connect,
    disconnect,
    fetchTab,
    rerun,
    summarizeCiRun,
    reset,
  } = useGithubStore();

  // Notification deep links arrive as ?tab=prs|issues|ci|commits, so the tab is
  // read from the URL rather than held in local state.
  const tab = (params.get('tab') ?? 'commits') as GithubTab;
  const [branch, setBranch] = useState('all');
  const [state, setState] = useState('all');
  const [dense, setDense] = useState(false);
  const [summarizingRunId, setSummarizingRunId] = useState<number | null>(null);

  const handleSummarize = (runId: number) => {
    setSummarizingRunId(runId);
    void summarizeCiRun(slug, key, runId)
      .then((summary) => {
        if (!summary) toast.error('AI summary unavailable right now.');
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not summarize this run.'))
      .finally(() => setSummarizingRunId(null));
  };

  useEffect(() => {
    if (slug && key) void fetchConnection(slug, key);
    return () => reset();
  }, [slug, key, fetchConnection, reset]);

  useEffect(() => {
    if (connection) void fetchTab(slug, key, tab, { branch, state });
  }, [connection, slug, key, tab, branch, state, fetchTab]);

  if (isLoadingConnection) {
    return (
      <PageShell>
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      </PageShell>
    );
  }

  if (!connection) {
    return (
      <PageShell narrow>
        <PageHeader title="GitHub" description="Link a repository to see commits, CI and pull requests here." />
        {connectionError ? (
          <ErrorState message={connectionError} className="mb-4" />
        ) : null}
        <ConnectCard slug={slug} projectKey={key} canConnect={canConnect} onConnect={connect} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="GitHub"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <a
              href={`https://github.com/${connection.githubRepoFullName}`}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              {connection.githubRepoFullName}
            </a>
            <Badge variant={connection.webhookStatus === 'active' ? 'secondary' : 'outline'}>
              webhook {connection.webhookStatus}
            </Badge>
            {connection.defaultBranch ? (
              <span className="text-xs">default: {connection.defaultBranch}</span>
            ) : null}
          </span>
        }
        actions={
          canConnect ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Disconnect
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect {connection.githubRepoFullName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The webhook is removed and no new commits or CI runs will be recorded. Existing
                    history stays.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      void disconnect(slug, key)
                        .then(() => toast.success('Repository disconnected'))
                        .catch((err: unknown) =>
                          toast.error(err instanceof Error ? err.message : 'Could not disconnect.'),
                        );
                    }}
                  >
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setBranch('all');
          setState('all');
          setParams({ tab: v });
        }}
        className="mb-4"
      >
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters relevant to the active tab */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(tab === 'commits' || tab === 'ci') && branchOptions.length > 0 ? (
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="w-56" aria-label="Filter by branch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branchOptions.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {tab === 'prs' || tab === 'issues' ? (
          <Select value={state} onValueChange={setState}>
            <SelectTrigger className="w-44" aria-label="Filter by state">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              {tab === 'prs' ? <SelectItem value="merged">Merged</SelectItem> : null}
            </SelectContent>
          </Select>
        ) : null}

        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={dense ? 'dense' : 'comfortable'}
          onValueChange={(v) => v && setDense(v === 'dense')}
          className="ml-auto"
          aria-label="Row density"
        >
          <ToggleGroupItem value="comfortable" aria-label="Comfortable density">
            <Rows3Icon className="size-4" aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem value="dense" aria-label="Compact density">
            <Rows2Icon className="size-4" aria-hidden="true" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {tabError ? (
        <ErrorState message={tabError} className="mb-4" />
      ) : null}

      {isLoadingTab ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="px-0">
            {tab === 'commits' ? (
              <RowList
                empty="No commits recorded yet. Push to the repo and the webhook will fill this in."
                rows={commits.items.map((c) => ({
                  id: c.id,
                  icon: <GitCommitHorizontalIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
                  title: c.messageHeadline,
                  mono: c.commitSha.slice(0, 7),
                  meta: [c.authorGithubLogin ?? c.authorName, c.branchName].filter(Boolean).join(' · '),
                  when: c.committedAt,
                  href: c.url,
                  taskKey: c.taskKey,
                  // Only when the commit's GitHub author resolved to a real
                  // DevSync member (authorUserId), and it isn't your own commit.
                  action:
                    c.authorUserId && c.authorUserId !== myUserId ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Message ${c.authorGithubLogin ?? c.authorName ?? 'commit author'}`}
                        disabled={dmBusyFor === c.authorUserId}
                        onClick={() => void messageCommitAuthor(c.authorUserId!)}
                      >
                        {dmBusyFor === c.authorUserId ? (
                          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <MessageSquareIcon className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    ) : undefined,
                }))}
                dense={dense}
                slug={slug}
                projectKey={key}
              />
            ) : null}

            {tab === 'ci' ? (
              <RowList
                empty="No workflow runs recorded yet."
                dense={dense}
                rows={ciRuns.items.map((run) => ({
                  id: run.id,
                  icon: <CiIcon conclusion={run.conclusion} status={run.status} />,
                  title: run.workflowName ?? 'Workflow',
                  mono: '',
                  meta: [run.headBranch, run.headSha?.slice(0, 7), run.conclusion ?? run.status]
                    .filter(Boolean)
                    .join(' · '),
                  when: run.triggeredAt,
                  href: run.htmlUrl,
                  taskKey: null,
                  action: (
                    <>
                      {run.conclusion === 'failure' ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={
                            run.aiFailureSummary
                              ? `AI summary already generated for ${run.workflowName ?? 'workflow'}`
                              : `Summarize failure for ${run.workflowName ?? 'workflow'}`
                          }
                          disabled={summarizingRunId === run.runId || !!run.aiFailureSummary}
                          onClick={() => handleSummarize(run.runId)}
                        >
                          {summarizingRunId === run.runId ? (
                            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <SparklesIcon className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      ) : null}
                      {canRerun ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Re-run ${run.workflowName ?? 'workflow'}`}
                          onClick={() => {
                            void rerun(slug, key, run.runId)
                              .then(() => toast.success('Re-run triggered on GitHub'))
                              .catch((err: unknown) =>
                                toast.error(err instanceof Error ? err.message : 'Could not re-run.'),
                              );
                          }}
                        >
                          <RefreshCwIcon className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </>
                  ),
                  footer: run.aiFailureSummary ? (
                    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                      <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">AI likely cause</p>
                        <p className="mt-1 text-sm text-muted-foreground">{run.aiFailureSummary}</p>
                      </div>
                    </div>
                  ) : summarizingRunId === run.runId ? (
                    // A spinner on the button alone is easy to miss — this fills
                    // the exact spot the real answer is about to land in, so it
                    // reads as "working on it" instead of leaving the click
                    // looking like it did nothing.
                    <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                      <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3.5 w-full max-w-md" />
                        <Skeleton className="h-3.5 w-2/3 max-w-sm" />
                      </div>
                    </div>
                  ) : undefined,
                }))}
                slug={slug}
                projectKey={key}
              />
            ) : null}

            {tab === 'prs' ? (
              <RowList
                empty="No pull requests recorded yet."
                rows={pullRequests.items.map((pr) => ({
                  id: pr.id,
                  icon: <GitPullRequestIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
                  title: pr.title,
                  mono: `#${pr.prNumber}`,
                  meta: [pr.authorGithubLogin, `${pr.headBranch} → ${pr.baseBranch}`]
                    .filter(Boolean)
                    .join(' · '),
                  when: pr.createdAt,
                  href: pr.htmlUrl,
                  taskKey: pr.taskKey,
                  badge: pr.state,
                }))}
                dense={dense}
                slug={slug}
                projectKey={key}
              />
            ) : null}

            {tab === 'issues' ? (
              <RowList
                empty="No issues recorded yet."
                rows={issues.items.map((issue) => ({
                  id: issue.id,
                  icon: <CircleDashedIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
                  title: issue.title,
                  mono: `#${issue.githubIssueNumber}`,
                  meta: issue.authorGithubLogin ?? '',
                  when: issue.createdAt,
                  href: issue.htmlUrl,
                  taskKey: issue.taskKey,
                  badge: issue.state,
                }))}
                dense={dense}
                slug={slug}
                projectKey={key}
              />
            ) : null}

            {tab === 'branches' ? (
              <RowList
                empty="No branches recorded yet."
                rows={branches.map((b) => ({
                  id: b.id,
                  icon: <GitBranchIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
                  title: b.branchName,
                  mono: '',
                  meta: b.isDeleted ? 'deleted' : '',
                  when: b.createdAt,
                  href: b.htmlUrl,
                  taskKey: b.taskKey,
                }))}
                dense={dense}
                slug={slug}
                projectKey={key}
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Paging — the branches endpoint returns everything at once. */}
      {tab !== 'branches' ? (
        <Pager
          page={pageFor(tab, { commits, ciRuns, pullRequests, issues }).page}
          totalPages={pageFor(tab, { commits, ciRuns, pullRequests, issues }).totalPages}
          totalCount={pageFor(tab, { commits, ciRuns, pullRequests, issues }).totalCount}
          onPage={(p) => void fetchTab(slug, key, tab, { page: p, branch, state })}
        />
      ) : null}
    </PageShell>
  );
}

function pageFor(
  tab: GithubTab,
  pages: {
    commits: { page: number; totalPages: number; totalCount: number };
    ciRuns: { page: number; totalPages: number; totalCount: number };
    pullRequests: { page: number; totalPages: number; totalCount: number };
    issues: { page: number; totalPages: number; totalCount: number };
  },
) {
  if (tab === 'commits') return pages.commits;
  if (tab === 'ci') return pages.ciRuns;
  if (tab === 'prs') return pages.pullRequests;
  return pages.issues;
}

function Pager({
  page,
  totalPages,
  totalCount,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPage: (page: number) => void;
}) {
  if (totalCount === 0) return null;
  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages} · {totalCount} total
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

interface Row {
  id: string;
  icon: React.ReactNode;
  title: string;
  mono: string;
  meta: string;
  when: string | null;
  href: string | null;
  taskKey: string | null;
  badge?: string;
  /** Per-row action, e.g. the CI tab's re-run button. */
  action?: React.ReactNode;
  /** Optional full-width content rendered as its own row below, e.g. the CI tab's AI summary. */
  footer?: React.ReactNode;
}

/**
 * Shared table for all five GitHub tabs.
 *
 * Previously a `<ul>` of flex rows — real tabular data (icon, key, title,
 * status, task link, timestamp) with no `<table>` semantics, so a screen
 * reader had no column meaning to announce. None of these rows are
 * drag-reorderable, unlike the backlog, so a literal `<table>` is safe here.
 */
function RowList({
  rows,
  empty,
  slug,
  projectKey,
  dense,
}: {
  rows: Row[];
  empty: string;
  slug: string;
  projectKey: string;
  dense: boolean;
}) {
  if (rows.length === 0) return <EmptyRow>{empty}</EmptyRow>;

  const cellPad = dense ? 'py-1.5' : 'py-3';

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Title</TableHead>
          <TableHead className="w-24">Task</TableHead>
          <TableHead className="hidden w-32 sm:table-cell">When</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <Fragment key={row.id}>
          <TableRow>
            <TableCell className={cellPad}>{row.icon}</TableCell>

            <TableCell className={cn(cellPad, 'max-w-0 whitespace-normal')}>
              <div className="flex items-center gap-2">
                {row.mono ? (
                  <code className="shrink-0 font-mono text-xs text-muted-foreground">
                    {row.mono}
                  </code>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {row.title}
                </span>
                {row.badge ? (
                  <Badge variant="outline" className="shrink-0">
                    {row.badge}
                  </Badge>
                ) : null}
              </div>
              {row.meta ? (
                <p className="truncate text-xs text-muted-foreground">{row.meta}</p>
              ) : null}
            </TableCell>

            <TableCell className={cellPad}>
              {/* Smart-commit linking is done server-side; surface the result. */}
              {row.taskKey ? (
                <Link
                  to={`/w/${slug}/projects/${projectKey}/tasks/${row.taskKey}`}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  {row.taskKey}
                </Link>
              ) : null}
            </TableCell>

            <TableCell className={cn(cellPad, 'hidden text-xs text-muted-foreground sm:table-cell')}>
              {row.when ? formatDistanceToNow(new Date(row.when), { addSuffix: true }) : null}
            </TableCell>

            <TableCell className={cellPad}>
              <div className="flex items-center gap-1">
                {row.action}
                {row.href ? <ExternalLink href={row.href} /> : null}
              </div>
            </TableCell>
          </TableRow>
          {row.footer ? (
            <TableRow>
              {/*
                `TableCell` bakes in `first:pl-6` (a pseudo-class, so a plain
                `pl-*` here wouldn't reliably win on specificity) — this cell
                is always first-child of its own row, so overriding the same
                `first:` variant is what actually takes effect. Set to exactly
                cancel the AI panel's own `p-3`, so its icon lines up with the
                row's leading icon above it instead of sitting 12px further in.
              */}
              <TableCell colSpan={5} className="whitespace-normal pt-0 pb-3 first:pl-3">
                {row.footer}
              </TableCell>
            </TableRow>
          ) : null}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

/** Compact empty state shared by all five GitHub tabs. */
function EmptyRow({ children }: { children: string }) {
  return <EmptyState compact title={children} className="py-10" />;
}

function ExternalLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="shrink-0 text-muted-foreground hover:text-foreground"
      aria-label="Open on GitHub"
    >
      <ExternalLinkIcon className="size-4" aria-hidden="true" />
    </a>
  );
}

function CiIcon({ conclusion, status }: { conclusion: string | null; status: string | null }) {
  if (conclusion === 'success') {
    return <CheckCircle2Icon className="size-4 shrink-0 text-status-done" aria-label="success" />;
  }
  if (conclusion === 'failure') {
    return <XCircleIcon className="size-4 shrink-0 text-priority-critical" aria-label="failure" />;
  }
  if (conclusion === 'cancelled' || conclusion === 'skipped') {
    return <CircleSlashIcon className="size-4 shrink-0 text-muted-foreground" aria-label={conclusion} />;
  }
  return (
    <Loader2Icon
      className={cn('size-4 shrink-0 text-status-in-review', status === 'in_progress' && 'animate-spin')}
      aria-label={status ?? 'queued'}
    />
  );
}

function ConnectCard({
  slug,
  projectKey,
  canConnect,
  onConnect,
}: {
  slug: string;
  projectKey: string;
  canConnect: boolean;
  onConnect: (slug: string, key: string, owner: string, name: string) => Promise<void>;
}) {
  const [owner, setOwner] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkingAccount, setLinkingAccount] = useState(false);

  // `repos === null` covers both "still loading" and "account not linked" —
  // `notLinked` disambiguates. Manual owner/repo entry only makes sense once
  // an account is linked (POST /connect 403s without one either way), so
  // there's no point showing those fields before that.
  const [repos, setRepos] = useState<GithubRepoOption[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/github/user/repos');
        if (!cancelled) {
          setRepos(data.repos ?? []);
          setNotLinked(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 401)) {
          // Not linked yet, or the stored token was revoked — same UI either way.
          setNotLinked(true);
        } else {
          // A real fetch failure (network, 500). Don't strand the user with no
          // way to connect at all — fall back to manual entry.
          setManualEntry(true);
        }
        setRepos(null);
      } finally {
        if (!cancelled) setLoadingRepos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!canConnect) {
    return (
      <Alert>
        <AlertTitle>No repository connected</AlertTitle>
        <AlertDescription>
          A project admin can connect one from this page.
        </AlertDescription>
      </Alert>
    );
  }

  const selectRepo = (repo: GithubRepoOption) => {
    setOwner(repo.owner);
    setName(repo.name);
    setPickerOpen(false);
    setRepoSearch('');
  };

  const filteredRepos = (repos ?? []).filter((r) =>
    r.fullName.toLowerCase().includes(repoSearch.trim().toLowerCase()),
  );

  const submit = async () => {
    if (!owner.trim() || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onConnect(slug, projectKey, owner.trim(), name.trim());
      toast.success('Repository connected');
    } catch (err) {
      // 403 when the user has not linked their GitHub account, 404 for an
      // unknown repo, 409 if already connected, 502 if the webhook fails.
      setError(err instanceof Error ? err.message : 'Could not connect the repository.');
    } finally {
      setBusy(false);
    }
  };

  // Repo connect calls GitHub's API as *this user*, so it needs their GitHub
  // account linked first (a stored access token). That's a one-time,
  // per-user step, separate from picking a repo — GET /github/oauth/url
  // returns the real GitHub consent screen URL, tagged with a `returnTo` so
  // GithubCallbackPage can land back on this exact tab once linked.
  const linkGithubAccount = async () => {
    setLinkingAccount(true);
    setError(null);
    try {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      const { url } = await apiFetch(`/github/oauth/url?returnTo=${encodeURIComponent(returnTo)}`);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start GitHub sign-in.');
      setLinkingAccount(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect a repository</CardTitle>
        <CardDescription>
          DevSync registers a webhook to record pushes, workflow runs, pull requests and issues.
          Smart commit messages like <code className="font-mono">fixes {projectKey}-12</code> move
          tasks automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <ErrorState
            message={error}
            description="Connecting requires your GitHub account to be linked to DevSync first."
          />
        ) : null}

        {notLinked ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
            <p className="text-sm text-muted-foreground">
              First time connecting a repository? Link your GitHub account once — DevSync uses it to
              verify the repo and register the webhook on your behalf.
            </p>
            <Button variant="outline" size="sm" onClick={() => void linkGithubAccount()} disabled={linkingAccount}>
              {linkingAccount ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
              Connect GitHub account
            </Button>
          </div>
        ) : loadingRepos ? (
          <Skeleton className="h-9 w-full max-w-md rounded-lg" />
        ) : !manualEntry ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <label className="mb-1.5 block text-sm text-foreground">Repository</label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn('truncate', !owner && !name && 'text-muted-foreground')}>
                      {owner && name ? `${owner}/${name}` : 'Select a repository…'}
                    </span>
                    <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
                  <div className="p-1.5">
                    <Input
                      autoFocus
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder="Search your repositories…"
                      className="h-8"
                    />
                  </div>
                  {filteredRepos.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                      {repos && repos.length === 0
                        ? "No repositories found on this account."
                        : "No matches."}
                    </p>
                  ) : (
                    // A plain scrollable div, not `ScrollArea` — that component's
                    // Viewport is `height: 100%`, which needs a *definite* height
                    // on its parent to resolve against. `max-h-*` alone only sets
                    // a ceiling, not a definite height, so the list never actually
                    // clipped: it rendered full-height, and Radix Popover's
                    // collision avoidance then shoved the whole thing up to fit
                    // the viewport, overlapping the trigger button entirely.
                    <div className="max-h-72 overflow-y-auto p-1">
                      <ul>
                        {filteredRepos.map((r) => {
                          const checked = r.owner === owner && r.name === name;
                          return (
                            <li key={r.id}>
                              <button
                                type="button"
                                onClick={() => selectRepo(r)}
                                aria-pressed={checked}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                              >
                                {r.private ? (
                                  <LockIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                ) : (
                                  <span className="size-3.5 shrink-0" />
                                )}
                                <span className="min-w-0 flex-1 truncate">{r.fullName}</span>
                                {checked ? <CheckIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={() => void submit()} disabled={busy || !owner.trim() || !name.trim()}>
              {busy ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
              Connect
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1">
              <label htmlFor="gh-owner" className="mb-1.5 block text-sm text-foreground">
                Owner
              </label>
              <Input
                id="gh-owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="octocat"
              />
            </div>
            <div className="min-w-40 flex-1">
              <label htmlFor="gh-name" className="mb-1.5 block text-sm text-foreground">
                Repository
              </label>
              <Input
                id="gh-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="hello-world"
              />
            </div>
            <Button onClick={() => void submit()} disabled={busy || !owner.trim() || !name.trim()}>
              {busy ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
              Connect
            </Button>
          </div>
        )}

        {!notLinked && !loadingRepos && repos && repos.length > 0 ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => setManualEntry((v) => !v)}
          >
            {manualEntry ? 'Pick from your repositories instead' : "Can't find it? Enter owner/repo manually"}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
