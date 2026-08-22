import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { GitBranch, GitPullRequest, CheckCircle2, XCircle, Loader2, RefreshCw, AlertCircle, ExternalLink, Plus, MessageSquare, Terminal } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { CreatePRModal } from './github/CreatePRModal.js';
import { CommentSection } from './github/CommentSection.js';
import { CiLogsModal } from './github/CiLogsModal.js';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface GithubConnection {
  connectionId?: string;
  githubRepoFullName: string;
  defaultBranch?: string;
  webhookStatus?: string;
  connectedByName?: string;
  connectedByAvatar?: string;
  createdAt?: string;
}

interface GithubCiRun {
  id: string;
  workflowName?: string;
  runId: number;
  status: string;
  conclusion?: string;
  headBranch?: string;
  headSha?: string;
  htmlUrl?: string;
  triggeredAt: string;
}

interface GithubPullRequest {
  id: string;
  prNumber: number;
  title: string;
  state: string;
  htmlUrl?: string;
  headBranch?: string;
  baseBranch?: string;
  taskId?: string;
  taskKey?: string;
}

interface GithubCommit {
  id: string;
  commitSha: string;
  messageHeadline: string;
  authorName?: string;
  authorAvatar?: string;
  committedAt: string;
  branchName?: string;
  url?: string;
  taskId?: string;
  taskKey?: string;
}

interface GithubIssue {
  id: string;
  githubIssueNumber: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  htmlUrl: string;
  authorGithubLogin?: string;
  labels?: string[];
  taskId?: string;
  taskKey?: string;
  closedAt?: string;
  createdAt: string;
}

export const GitHubIntegration = () => {
  const { slug, key } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as 'prs' | 'issues' | 'ci' | 'commits' | null;
  const activeTab: 'prs' | 'issues' | 'ci' | 'commits' =
    tabParam && ['prs', 'issues', 'ci', 'commits'].includes(tabParam) ? tabParam : 'prs';

  const setActiveTab = (tab: 'prs' | 'issues' | 'ci' | 'commits') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };
  
  const { isAdmin } = useCurrentWorkspaceStore();
  const currentUser = useAuthStore(state => state.user);
  const [isProjectAdmin, setIsProjectAdmin] = useState(false);
  
  // Connection State
  const [connection, setConnection] = useState<GithubConnection | null>(null);
  const [isConnLoading, setIsConnLoading] = useState(true);

  const [ciRuns, setCiRuns] = useState<GithubCiRun[]>([]);
  const [ciTotal, setCiTotal] = useState(0);
  const [ciPage, setCiPage] = useState(1);

  const [prs, setPrs] = useState<GithubPullRequest[]>([]);
  const [prsTotal, setPrsTotal] = useState(0);
  const [prsPage, setPrsPage] = useState(1);

  const [issues, setIssues] = useState<GithubIssue[]>([]);
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [issuesPage, setIssuesPage] = useState(1);
  const [issueStateFilter, setIssueStateFilter] = useState<'all' | 'open' | 'closed'>('all');

  const [commits, setCommits] = useState<GithubCommit[]>([]);
  const [commitsTotal, setCommitsTotal] = useState(0);
  const [commitsPage, setCommitsPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [branchFilter, setBranchFilter] = useState('all');
  const [branchesList, setBranchesList] = useState<string[]>([]);
  const [ciConclusionFilter, setCiConclusionFilter] = useState('all');
  const [prStateFilter, setPrStateFilter] = useState('all'); // all, open, closed, merged

  // Modals State
  const [showCreatePR, setShowCreatePR] = useState(false);

  // Inline commenting state: tracks which issue/PR number has its comment form open
  const [commentingOn, setCommentingOn] = useState<{ type: 'issue' | 'pr'; number: number } | null>(null);
  
  // CI Logs State
  const [viewingLogsForRunId, setViewingLogsForRunId] = useState<number | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const data = await apiFetch(`/workspaces/${slug}/projects/${key}/members`);
        const members = data.members || [];
        const myMembership = members.find((m: { userId: string; role: string }) => m.userId === currentUser?.userId);
        setIsProjectAdmin(myMembership?.role === 'project_admin');
      } catch (err) {
        console.error('Failed to fetch project members for GitHub integration', err);
      }
    };
    if (slug && key) fetchRole();
  }, [slug, key, currentUser?.userId]);

  useEffect(() => {
    const fetchConnection = async () => {
      try {
        const data = await apiFetch(`/workspaces/${slug}/projects/${key}/github/connection`);
        setConnection(data.connection);
      } catch (err) {
        console.error('Failed to load GitHub connection', err);
      } finally {
        setIsConnLoading(false);
      }
    };
    if (slug && key) fetchConnection();
  }, [slug, key]);

  const fetchCiRuns = useCallback(async (page = ciPage) => {
    setIsLoading(true); setError(null);
    try {
      let url = `/workspaces/${slug}/projects/${key}/github/ci?page=${page}&limit=25`;
      if (branchFilter !== 'all') url += `&branch=${encodeURIComponent(branchFilter)}`;
      if (ciConclusionFilter !== 'all') url += `&conclusion=${encodeURIComponent(ciConclusionFilter)}`;

      const res = await apiFetch(url);
      setCiRuns(res.runs || []); setCiTotal(res.totalCount || 0);
      setCiPage(res.page || 1);
      setBranchesList(prev => Array.from(new Set([...prev, ...(res.branches || [])])));
    } catch (err: unknown) { const e = err as Error; setError(e.message || 'Failed to fetch CI runs'); } finally { setIsLoading(false); }
  }, [slug, key, ciPage, branchFilter, ciConclusionFilter]);

  const fetchPrs = useCallback(async (page = prsPage) => {
    setIsLoading(true); setError(null);
    try {
      let url = `/workspaces/${slug}/projects/${key}/github/pull-requests?page=${page}&limit=25`;
      if (prStateFilter !== 'all') url += `&state=${prStateFilter}`;
      const res = await apiFetch(url);
      setPrs(res.pullRequests || []); setPrsTotal(res.totalCount || 0);
      setPrsPage(res.page || 1);
    } catch (err: unknown) { const e = err as Error; setError(e.message || 'Failed to fetch PRs'); } finally { setIsLoading(false); }
  }, [slug, key, prsPage, prStateFilter]);

  const fetchCommits = useCallback(async (page = commitsPage) => {
    setIsLoading(true); setError(null);
    try {
      let url = `/workspaces/${slug}/projects/${key}/github/commits?page=${page}&limit=25`;
      if (branchFilter !== 'all') url += `&branch=${encodeURIComponent(branchFilter)}`;
      const res = await apiFetch(url);
      setCommits(res.commits || []); setCommitsTotal(res.totalCount || 0);
      setCommitsPage(res.page || 1);
      setBranchesList(prev => Array.from(new Set([...prev, ...(res.branches || [])])));
    } catch (err: unknown) { const e = err as Error; setError(e.message || 'Failed to fetch commits'); } finally { setIsLoading(false); }
  }, [slug, key, commitsPage, branchFilter]);

  const fetchIssues = useCallback(async (page = issuesPage) => {
    setIsLoading(true); setError(null);
    try {
      let url = `/workspaces/${slug}/projects/${key}/github/issues?page=${page}&limit=25`;
      if (issueStateFilter !== 'all') url += `&state=${issueStateFilter}`;
      const res = await apiFetch(url);
      setIssues(res.issues || []); setIssuesTotal(res.totalCount || 0);
      setIssuesPage(res.page || 1);
    } catch (err: unknown) { const e = err as Error; setError(e.message || 'Failed to fetch Issues'); } finally { setIsLoading(false); }
  }, [slug, key, issuesPage, issueStateFilter]);

  useEffect(() => {
    if (!slug || !key) return;
    let cancelled = false;

    const loadData = async () => {
      await Promise.resolve();
      if (cancelled) return;

      if (activeTab === 'prs') fetchPrs(1);
      else if (activeTab === 'issues') fetchIssues(1);
      else if (activeTab === 'ci') fetchCiRuns(1);
      else if (activeTab === 'commits') fetchCommits(1);
    };

    loadData();

    return () => { cancelled = true; };
  }, [slug, key, activeTab, fetchPrs, fetchCiRuns, fetchCommits, fetchIssues]);

  const handleRefresh = () => {
    if (activeTab === 'prs') fetchPrs(prsPage);
    else if (activeTab === 'issues') fetchIssues(issuesPage);
    else if (activeTab === 'ci') fetchCiRuns(ciPage);
    else if (activeTab === 'commits') fetchCommits(commitsPage);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as 'prs' | 'issues' | 'ci' | 'commits')}
      className="h-full gap-0 font-sans bg-background text-foreground"
    >
      
      {/* Banner */}
      {!isConnLoading && !connection && (isAdmin() || isProjectAdmin) && (
        <div className="bg-primary flex items-center justify-between px-6 py-3 text-primary-foreground">
          <div className="flex items-center space-x-3">
            <GitBranch className="w-5 h-5" strokeWidth={1.75} />
            <span className="font-[590] text-ui">No GitHub repository connected</span>
          </div>
          <Link 
            to={`/w/${slug}/projects/${key}/settings`} 
            className="bg-background text-primary px-3 py-1.5 rounded text-ui font-[590] hover:bg-hover transition-colors"
          >
            Connect a repository in Project Settings
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-heading font-[590] text-foreground flex items-center mb-1">
              <GitBranch className="w-6 h-6 mr-3 text-foreground" strokeWidth={1.5} />
              GitHub Integration
            </h2>
            <p className="text-ui text-muted-foreground mb-6">Track pull requests and CI/CD pipelines connected to project tasks.</p>
          </div>
          <div className="flex items-center space-x-4">
            {connection && (
              <a 
                href={`https://github.com/${connection.githubRepoFullName}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center text-ui font-[590] text-muted-foreground hover:text-foreground bg-card border border-border px-3 py-1.5 rounded-lg transition-colors"
              >
                {connection.githubRepoFullName}
                <ExternalLink className="w-4 h-4 ml-2 text-subtle-foreground" strokeWidth={1.75} />
              </a>
            )}
            <Button 
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-hover rounded-lg transition-colors disabled:opacity-50"
              size="icon" variant="ghost"
            >
              <RefreshCw className={clsx("w-5 h-5", isLoading && "animate-spin")} strokeWidth={1.75} />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <TabsList  className="w-full justify-start gap-6 border-b border-border px-1">
            <TabsTrigger value="prs" className="flex-1">
              Pull Requests {prsTotal > 0 && <span className="ml-1.5 bg-hover text-foreground py-0.5 px-2 rounded-full text-caption">{prsTotal}</span>}
            </TabsTrigger>
            <TabsTrigger value="issues">
              Issues {issuesTotal > 0 && <span className="ml-1.5 bg-hover text-foreground py-0.5 px-2 rounded-full text-caption">{issuesTotal}</span>}
            </TabsTrigger>
            <TabsTrigger value="ci">
              CI Runs {ciTotal > 0 && <span className="ml-1.5 bg-hover text-foreground py-0.5 px-2 rounded-full text-caption">{ciTotal}</span>}
            </TabsTrigger>
            <TabsTrigger value="commits">
              Commits {commitsTotal > 0 && <span className="ml-1.5 bg-hover text-foreground py-0.5 px-2 rounded-full text-caption">{commitsTotal}</span>}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-3 mb-2">

            
            {activeTab === 'ci' && (
              <Select value={ciConclusionFilter} onValueChange={setCiConclusionFilter}>
                <SelectTrigger className="bg-elevated">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Passed</SelectItem>
                  <SelectItem value="failure">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            )}

            {activeTab === 'prs' && (
              <div className="flex space-x-2">
                <Select value={prStateFilter} onValueChange={setPrStateFilter}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="merged">Merged</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => setShowCreatePR(true)}
                  className="bg-primary hover:bg-primary-hover text-primary-foreground text-ui font-[590] px-3 py-1.5 rounded-lg flex items-center transition-colors"
                  variant="primary" size="default"
                >
                  <Plus className="w-4 h-4 mr-1" strokeWidth={1.75} /> New PR
                </Button>
              </div>
            )}
            
            {activeTab === 'issues' && (
              <div className="flex space-x-2">
                <Select value={issueStateFilter} onValueChange={(v) => setIssueStateFilter(v as 'all' | 'open' | 'closed')}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}


            {(activeTab === 'ci' || activeTab === 'commits') && (
              <div className="flex space-x-2">
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="bg-elevated max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branchesList.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-(--z-sticky) flex items-start justify-center pt-24">
            <Loader2 className="w-8 h-8 animate-spin text-subtle-foreground" strokeWidth={1.5} />
          </div>
        )}

        {error ? (
          <div className="text-center py-12 border border-dashed border-danger-border bg-danger-muted rounded-lg">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-destructive">{error}</p>
          </div>
        ) : (
          <>
          <TabsContent value="prs" className="space-y-4 max-w-5xl">
            {prs.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card">
                <GitPullRequest className="w-10 h-10 text-subtle-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-heading font-[590] text-foreground mb-1">No pull requests found</h3>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted border-b border-border text-caption font-[590] text-muted-foreground tracking-wider">
                      <th className="px-4 py-3 w-24">PR</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3 w-32">Status</th>
                      <th className="px-4 py-3 w-32">Task</th>
                      <th className="px-4 py-3 w-40">Branches</th>
                      <th className="px-4 py-3 w-24 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {prs.map(pr => (
                      <tr key={pr.id} className="group">
                        <td colSpan={6} className="p-0">
                          <div className="hover:bg-hover transition-colors px-4 py-3 grid" style={{ gridTemplateColumns: '6rem 1fr 8rem 8rem 10rem 6rem' }}>
                            <span className="text-ui font-mono text-muted-foreground">#{pr.prNumber}</span>
                            <span className="text-ui text-foreground">{pr.title}</span>
                            <span>
                              {pr.state === 'open' && <Badge variant="success" className="h-auto py-1">Open</Badge>}
                              {pr.state === 'merged' && <Badge variant="secondary" className="bg-special-muted text-special border-special-border h-auto py-1">Merged</Badge>}
                              {pr.state === 'closed' && <Badge variant="destructive" className="h-auto py-1">Closed</Badge>}
                            </span>
                            <span>
                              {pr.taskId ? <Link to={`/w/${slug}/projects/${key}/tasks/${pr.taskKey}`} className="inline-flex bg-hover hover:bg-hover text-foreground border border-border text-micro uppercase font-[590] tracking-wider px-2 py-0.5 rounded transition-colors">{pr.taskKey}</Link> : <span className="text-subtle-foreground">—</span>}
                            </span>
                            <span className="text-caption text-muted-foreground">
                              {pr.headBranch} → {pr.baseBranch}
                            </span>
                            <span className="flex items-center justify-end space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => setCommentingOn(commentingOn?.type === 'pr' && commentingOn.number === pr.prNumber ? null : { type: 'pr', number: pr.prNumber })}
                                    className={clsx(
                                      'text-caption px-2 py-1 rounded transition-colors flex items-center',
                                      commentingOn?.type === 'pr' && commentingOn.number === pr.prNumber
                                        ? 'text-primary bg-primary-muted border border-primary-border'
                                        : 'text-subtle-foreground hover:text-foreground opacity-0 group-hover:opacity-100'
                                    )}
                                    aria-label="Add comment"
                                    size="icon" variant="ghost"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add comment</TooltipContent>
                              </Tooltip>
                              {pr.htmlUrl && <a href={pr.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex text-muted-foreground hover:text-foreground"><ExternalLink className="w-4 h-4" strokeWidth={1.75} /></a>}
                            </span>
                          </div>
                          {commentingOn?.type === 'pr' && commentingOn.number === pr.prNumber && (
                            <div className="px-4 pb-3">
                              <CommentSection
                                slug={slug as string}
                                keyStr={key as string}
                                type="pr"
                                number={pr.prNumber}
                                onClose={() => setCommentingOn(null)}
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="issues" className="space-y-4 max-w-5xl">
            {issues.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card">
                <AlertCircle className="w-10 h-10 text-subtle-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-heading font-[590] text-foreground mb-1">No issues found</h3>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted border-b border-border text-caption font-[590] text-muted-foreground tracking-wider">
                      <th className="px-4 py-3 w-16">#</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3 w-28">Status</th>
                      <th className="px-4 py-3 w-32">Author</th>
                      <th className="px-4 py-3 w-32">Labels</th>
                      <th className="px-4 py-3 w-28">Task</th>
                      <th className="px-4 py-3 w-32">Date</th>
                      <th className="px-4 py-3 w-16 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {issues.map(issue => (
                      <tr key={issue.id} className="hover:bg-hover transition-colors">
                        <td className="px-4 py-3 text-caption font-mono text-subtle-foreground">#{issue.githubIssueNumber}</td>
                        <td className="px-4 py-3 text-ui text-foreground font-[510] truncate max-w-sm" title={issue.title}>{issue.title}</td>
                        <td className="px-4 py-3">
                          {issue.state === 'open' 
                            ? <Badge variant="success" className="text-micro h-auto uppercase font-[590] tracking-wider"><AlertCircle className="w-3 h-3 mr-1" strokeWidth={1.75} /> Open</Badge>
                            : <Badge variant="destructive" className="text-micro h-auto uppercase font-[590] tracking-wider"><AlertCircle className="w-3 h-3 mr-1" strokeWidth={1.75} /> Closed</Badge>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-caption text-muted-foreground truncate w-24">{issue.authorGithubLogin || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3 text-caption text-muted-foreground truncate max-w-xs" title={(issue.labels || []).join(', ')}>
                          {(issue.labels || []).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {issue.taskId ? <Link to={`/w/${slug}/projects/${key}/tasks/${issue.taskKey}`} className="inline-flex bg-hover hover:bg-hover text-foreground border border-border text-micro uppercase font-[590] tracking-wider px-2 py-0.5 rounded transition-colors">{issue.taskKey}</Link> : <span className="text-subtle-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-caption text-subtle-foreground">{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</td>
                        <td className="px-4 py-3 text-right">
                          <a href={issue.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex text-muted-foreground hover:text-foreground"><ExternalLink className="w-4 h-4" strokeWidth={1.75} /></a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="commits" className="space-y-4 max-w-5xl">
            {commits.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card">
                <GitBranch className="w-10 h-10 text-subtle-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-heading font-[590] text-foreground mb-1">No commits found</h3>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted border-b border-border text-caption font-[590] text-muted-foreground tracking-wider">
                      <th className="px-4 py-3 w-24">SHA</th>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3 w-32">Author</th>
                      <th className="px-4 py-3 w-40">Branch</th>
                      <th className="px-4 py-3 w-32">Task</th>
                      <th className="px-4 py-3 w-32">Date</th>
                      <th className="px-4 py-3 w-16 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {commits.map(commit => (
                      <tr key={commit.id} className="hover:bg-hover transition-colors">
                        <td className="px-4 py-3 text-caption font-mono text-primary">{commit.commitSha.substring(0, 7)}</td>
                        <td className="px-4 py-3 text-ui text-foreground truncate max-w-xs" title={commit.messageHeadline}>{commit.messageHeadline}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            {commit.authorAvatar ? (
                              <Avatar size="sm" className="size-5">
                                <AvatarImage src={commit.authorAvatar} alt="" />
                              </Avatar>
                            ) : (
                              <Avatar size="sm" className="size-5 border border-border">
                                <AvatarFallback className="bg-hover text-micro text-muted-foreground font-[590]">
                                  {(commit.authorName || '?').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <span className="text-caption text-muted-foreground truncate w-24">{commit.authorName || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-caption font-mono text-muted-foreground truncate w-40" title={commit.branchName || ''}>{commit.branchName || '—'}</td>
                        <td className="px-4 py-3">
                          {commit.taskId ? <Link to={`/w/${slug}/projects/${key}/tasks/${commit.taskKey}`} className="inline-flex bg-hover hover:bg-hover text-foreground border border-border text-micro uppercase font-[590] tracking-wider px-2 py-0.5 rounded transition-colors">{commit.taskKey}</Link> : <span className="text-subtle-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-caption text-subtle-foreground">{formatDistanceToNow(new Date(commit.committedAt), { addSuffix: true })}</td>
                        <td className="px-4 py-3 text-right">
                          {commit.url && <a href={commit.url} target="_blank" rel="noreferrer" className="inline-flex text-muted-foreground hover:text-foreground"><ExternalLink className="w-4 h-4" strokeWidth={1.75} /></a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="ci" className="space-y-4 max-w-5xl">
            {ciRuns.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card">
                <CheckCircle2 className="w-10 h-10 text-subtle-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-heading font-[590] text-foreground mb-1">No workflow runs yet</h3>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted border-b border-border text-caption font-[590] text-muted-foreground tracking-wider">
                      <th className="px-4 py-3">Workflow</th>
                      <th className="px-4 py-3 w-32">Status</th>
                      <th className="px-4 py-3 w-40">Branch</th>
                      <th className="px-4 py-3 w-24">Commit</th>
                      <th className="px-4 py-3 w-32">Started</th>
                      <th className="px-4 py-3 w-32 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ciRuns.map(run => (
                      <tr key={run.id} className="hover:bg-hover transition-colors">
                        <td className="px-4 py-3 text-ui text-foreground">{run.workflowName || 'Workflow'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1.5">
                            {run.status === 'in_progress' ? <Badge variant="secondary" className="bg-primary-muted text-primary border-primary-border h-auto py-1"><Loader2 className="w-3 h-3 mr-1 animate-spin" strokeWidth={1.75} /> Running</Badge> :
                             run.status === 'queued' ? <Badge variant="secondary" className="h-auto py-1">Queued</Badge> :
                             run.conclusion === 'success' ? <Badge variant="success" className="h-auto py-1"><CheckCircle2 className="w-3 h-3 mr-1" strokeWidth={1.75} /> Passed</Badge> :
                             run.conclusion === 'failure' ? <Badge variant="destructive" className="h-auto py-1"><XCircle className="w-3 h-3 mr-1" strokeWidth={1.75} /> Failed</Badge> :
                             <Badge variant="secondary" className="h-auto py-1">Skipped</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-caption font-mono text-muted-foreground">{run.headBranch || '—'}</td>
                        <td className="px-4 py-3 text-ui font-mono text-muted-foreground">{run.headSha?.substring(0, 7) || '—'}</td>
                        <td className="px-4 py-3 text-caption text-subtle-foreground">{formatDistanceToNow(new Date(run.triggeredAt), { addSuffix: true })}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {run.conclusion === 'failure' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      onClick={() => setViewingLogsForRunId(run.runId)}
                                      className="text-caption text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded bg-hover flex items-center transition-colors"
                                      variant="secondary" size="default"
                                    >
                                      <Terminal className="w-3 h-3 mr-1" strokeWidth={1.75} />
                                      Debug
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View Terminal Logs</TooltipContent>
                                </Tooltip>
                              )}
                            {run.htmlUrl && <a href={run.htmlUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="w-4 h-4" strokeWidth={1.75} /></a>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          </>
        )}
      </div>

      {showCreatePR && (
        <CreatePRModal
          slug={slug as string}
          keyStr={key as string}
          onClose={() => setShowCreatePR(false)}
          onCreated={() => {
            setShowCreatePR(false);
            fetchPrs(1);
          }}
        />
      )}

      {viewingLogsForRunId && (
        <CiLogsModal
          slug={slug as string}
          keyStr={key as string}
          runId={viewingLogsForRunId as number}
          onClose={() => setViewingLogsForRunId(null)}
        />
      )}
    </Tabs>
  );
};
