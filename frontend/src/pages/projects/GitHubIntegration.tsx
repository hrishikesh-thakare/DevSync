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
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as 'prs' | 'issues' | 'ci' | 'commits' | null;
  const [activeTab, setActiveTab] = useState<'prs' | 'issues' | 'ci' | 'commits'>(
    tabParam && ['prs', 'issues', 'ci', 'commits'].includes(tabParam) ? tabParam : 'prs'
  );

  useEffect(() => {
    if (tabParam && ['prs', 'issues', 'ci', 'commits'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  
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
    <div className="h-full flex flex-col font-sans bg-gray-950 text-gray-200">
      
      {/* Banner */}
      {!isConnLoading && !connection && (isAdmin() || isProjectAdmin) && (
        <div className="bg-blue-600 flex items-center justify-between px-6 py-3 text-white">
          <div className="flex items-center space-x-3">
            <GitBranch className="w-5 h-5" />
            <span className="font-semibold text-sm">No GitHub repository connected</span>
          </div>
          <Link 
            to={`/w/${slug}/projects/${key}/settings`} 
            className="bg-white text-blue-700 px-3 py-1.5 rounded text-sm font-bold hover:bg-gray-100 transition-colors"
          >
            Connect a repository in Project Settings
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-gray-800/60 shrink-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center mb-1">
              <GitBranch className="w-6 h-6 mr-3 text-white" />
              GitHub Integration
            </h2>
            <p className="text-sm text-gray-400 mb-6">Track pull requests and CI/CD pipelines connected to project tasks.</p>
          </div>
          <div className="flex items-center space-x-4">
            {connection && (
              <a 
                href={`https://github.com/${connection.githubRepoFullName}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center text-sm font-semibold text-gray-300 hover:text-white bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg transition-colors"
              >
                {connection.githubRepoFullName}
                <ExternalLink className="w-4 h-4 ml-2 text-gray-500" />
              </a>
            )}
            <button 
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx("w-5 h-5", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex space-x-6">

            <button 
              onClick={() => setActiveTab('prs')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'prs' ? 'border-white text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Pull Requests {prsTotal > 0 && <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-xs">{prsTotal}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('issues')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'issues' ? 'border-white text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Issues {issuesTotal > 0 && <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-xs">{issuesTotal}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('ci')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ci' ? 'border-white text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              CI Runs {ciTotal > 0 && <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-xs">{ciTotal}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('commits')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'commits' ? 'border-white text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Commits {commitsTotal > 0 && <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-xs">{commitsTotal}</span>}
            </button>
          </div>

          <div className="flex items-center space-x-3 mb-2">

            
            {activeTab === 'ci' && (
              <select 
                value={ciConclusionFilter}
                onChange={e => setCiConclusionFilter(e.target.value)}
                className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="success">Passed</option>
                <option value="failure">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}

            {activeTab === 'prs' && (
              <div className="flex space-x-2">
                <select 
                  value={prStateFilter}
                  onChange={e => setPrStateFilter(e.target.value)}
                  className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
                >
                  <option value="all">All States</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="merged">Merged</option>
                </select>
                <button 
                  onClick={() => setShowCreatePR(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" /> New PR
                </button>
              </div>
            )}
            
            {activeTab === 'issues' && (
              <div className="flex space-x-2">
                <select 
                  value={issueStateFilter}
                  onChange={e => setIssueStateFilter(e.target.value as 'all' | 'open' | 'closed')}
                  className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
                >
                  <option value="all">All States</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}


            {(activeTab === 'ci' || activeTab === 'commits') && (
              <div className="flex space-x-2">
                <select 
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none max-w-[200px]"
                >
                  <option value="all">All Branches</option>
                  {branchesList.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-[1px] z-10 flex items-start justify-center pt-24">
            <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        )}

        {error ? (
          <div className="text-center py-12 border border-dashed border-red-500/30 bg-red-500/5 rounded-xl">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : activeTab === 'prs' ? (
          <div className="space-y-4 max-w-5xl">
            {prs.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl bg-gray-900/30">
                <GitPullRequest className="w-10 h-10 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-300 mb-1">No pull requests found</h3>
              </div>
            ) : (
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900/80 border-b border-gray-800 text-xs font-semibold text-gray-400 tracking-wider">
                      <th className="px-4 py-3 w-24">PR</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3 w-32">Status</th>
                      <th className="px-4 py-3 w-32">Task</th>
                      <th className="px-4 py-3 w-40">Branches</th>
                      <th className="px-4 py-3 w-24 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {prs.map(pr => (
                      <tr key={pr.id} className="group">
                        <td colSpan={6} className="p-0">
                          <div className="hover:bg-gray-800/30 transition-colors px-4 py-3 grid" style={{ gridTemplateColumns: '6rem 1fr 8rem 8rem 10rem 6rem' }}>
                            <span className="text-sm font-mono text-gray-400">#{pr.prNumber}</span>
                            <span className="text-sm text-gray-200">{pr.title}</span>
                            <span>
                              {pr.state === 'open' && <span className="text-green-400 text-xs px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">Open</span>}
                              {pr.state === 'merged' && <span className="text-purple-400 text-xs px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">Merged</span>}
                              {pr.state === 'closed' && <span className="text-red-400 text-xs px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-full">Closed</span>}
                            </span>
                            <span>
                              {pr.taskId ? <Link to={`/w/${slug}/projects/${key}/tasks/${pr.taskKey}`} className="inline-flex bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded transition-colors">{pr.taskKey}</Link> : <span className="text-gray-600">—</span>}
                            </span>
                            <span className="text-xs text-gray-400">
                              {pr.headBranch} → {pr.baseBranch}
                            </span>
                            <span className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => setCommentingOn(commentingOn?.type === 'pr' && commentingOn.number === pr.prNumber ? null : { type: 'pr', number: pr.prNumber })}
                                className={clsx(
                                  'text-xs px-2 py-1 rounded transition-colors flex items-center',
                                  commentingOn?.type === 'pr' && commentingOn.number === pr.prNumber
                                    ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                                    : 'text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100'
                                )}
                                title="Add comment"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              {pr.htmlUrl && <a href={pr.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex text-gray-400 hover:text-white"><ExternalLink className="w-4 h-4" /></a>}
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
          </div>
        ) : activeTab === 'issues' ? (
          <div className="space-y-4 max-w-5xl">
            {issues.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl bg-gray-900/30">
                <AlertCircle className="w-10 h-10 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-300 mb-1">No issues found</h3>
              </div>
            ) : (
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900/80 border-b border-gray-800 text-xs font-semibold text-gray-400 tracking-wider">
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
                  <tbody className="divide-y divide-gray-800/60">
                    {issues.map(issue => (
                      <tr key={issue.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">#{issue.githubIssueNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-200 font-medium truncate max-w-sm" title={issue.title}>{issue.title}</td>
                        <td className="px-4 py-3">
                          {issue.state === 'open' 
                            ? <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Open</span>
                            : <span className="inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20"><AlertCircle className="w-3 h-3 mr-1" /> Closed</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-400 truncate w-24">{issue.authorGithubLogin || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 truncate max-w-xs" title={(issue.labels || []).join(', ')}>
                          {(issue.labels || []).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {issue.taskId ? <Link to={`/w/${slug}/projects/${key}/tasks/${issue.taskKey}`} className="inline-flex bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded transition-colors">{issue.taskKey}</Link> : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}</td>
                        <td className="px-4 py-3 text-right">
                          <a href={issue.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex text-gray-400 hover:text-white"><ExternalLink className="w-4 h-4" /></a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'commits' ? (
          <div className="space-y-4 max-w-5xl">
            {commits.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl bg-gray-900/30">
                <GitBranch className="w-10 h-10 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-300 mb-1">No commits found</h3>
              </div>
            ) : (
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900/80 border-b border-gray-800 text-xs font-semibold text-gray-400 tracking-wider">
                      <th className="px-4 py-3 w-24">SHA</th>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3 w-32">Author</th>
                      <th className="px-4 py-3 w-40">Branch</th>
                      <th className="px-4 py-3 w-32">Task</th>
                      <th className="px-4 py-3 w-32">Date</th>
                      <th className="px-4 py-3 w-16 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {commits.map(commit => (
                      <tr key={commit.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-blue-400">{commit.commitSha.substring(0, 7)}</td>
                        <td className="px-4 py-3 text-sm text-gray-200 truncate max-w-xs" title={commit.messageHeadline}>{commit.messageHeadline}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            {commit.authorAvatar ? (
                              <img src={commit.authorAvatar} alt="" className="w-5 h-5 rounded-full" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-400 font-bold">
                                {(commit.authorName || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-gray-400 truncate w-24">{commit.authorName || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-400 truncate w-40" title={commit.branchName || ''}>{commit.branchName || '—'}</td>
                        <td className="px-4 py-3">
                          {commit.taskId ? <Link to={`/w/${slug}/projects/${key}/tasks/${commit.taskKey}`} className="inline-flex bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded transition-colors">{commit.taskKey}</Link> : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatDistanceToNow(new Date(commit.committedAt), { addSuffix: true })}</td>
                        <td className="px-4 py-3 text-right">
                          {commit.url && <a href={commit.url} target="_blank" rel="noreferrer" className="inline-flex text-gray-400 hover:text-white"><ExternalLink className="w-4 h-4" /></a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-w-5xl">
            {ciRuns.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl bg-gray-900/30">
                <CheckCircle2 className="w-10 h-10 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-300 mb-1">No workflow runs yet</h3>
              </div>
            ) : (
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900/80 border-b border-gray-800 text-xs font-semibold text-gray-400 tracking-wider">
                      <th className="px-4 py-3">Workflow</th>
                      <th className="px-4 py-3 w-32">Status</th>
                      <th className="px-4 py-3 w-40">Branch</th>
                      <th className="px-4 py-3 w-24">Commit</th>
                      <th className="px-4 py-3 w-32">Started</th>
                      <th className="px-4 py-3 w-32 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {ciRuns.map(run => (
                      <tr key={run.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-200">{run.workflowName || 'Workflow'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-1.5">
                            {run.status === 'in_progress' ? <span className="text-blue-400 text-xs px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running</span> :
                             run.status === 'queued' ? <span className="text-gray-400 text-xs px-2 py-1 bg-gray-500/10 border border-gray-500/20 rounded">Queued</span> :
                             run.conclusion === 'success' ? <span className="text-emerald-400 text-xs px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Passed</span> :
                             run.conclusion === 'failure' ? <span className="text-red-400 text-xs px-2 py-1 bg-red-500/10 border border-red-500/20 rounded flex items-center"><XCircle className="w-3 h-3 mr-1" /> Failed</span> :
                             <span className="text-gray-400 text-xs px-2 py-1 bg-gray-500/10 border border-gray-500/20 rounded">Skipped</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-400">{run.headBranch || '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-400">{run.headSha?.substring(0, 7) || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{formatDistanceToNow(new Date(run.triggeredAt), { addSuffix: true })}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {run.conclusion === 'failure' && (
                                <button 
                                  onClick={() => setViewingLogsForRunId(run.runId)}
                                  className="text-xs text-gray-400 hover:text-white border border-gray-600 px-2 py-1 rounded bg-gray-800/50 flex items-center transition-colors"
                                  title="View Terminal Logs"
                                >
                                  <Terminal className="w-3 h-3 mr-1" />
                                  Debug
                                </button>
                              )}
                            {run.htmlUrl && <a href={run.htmlUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white"><ExternalLink className="w-4 h-4" /></a>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
    </div>
  );
};
