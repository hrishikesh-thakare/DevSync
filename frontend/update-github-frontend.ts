import * as fs from 'fs';

const originalPath = 'src/pages/projects/GitHubIntegration.tsx';
const originalContent = fs.readFileSync(originalPath, 'utf8');

// I will construct the new content.
// Since it's huge, I'll do this in a few steps inside the typescript file, or better yet, I'll just write the entire new content in this script.

const newContent = `import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GitBranch, GitCommit, GitPullRequest, CheckCircle2, XCircle, Loader2, RefreshCw, AlertCircle, ExternalLink, ChevronLeft, ChevronRight, Plus, MessageSquare } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { formatDistanceToNow, format } from 'date-fns';
import clsx from 'clsx';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';

export const GitHubIntegration = () => {
  const { slug, key } = useParams();
  const [activeTab, setActiveTab] = useState<'commits' | 'prs' | 'issues' | 'branches' | 'ci'>('commits');
  
  const { isAdmin } = useCurrentWorkspaceStore();
  const currentUser = useAuthStore(state => state.user);
  const [isProjectAdmin, setIsProjectAdmin] = useState(false);
  
  // Connection State
  const [connection, setConnection] = useState<any>(null);
  const [isConnLoading, setIsConnLoading] = useState(true);

  // Data State
  const [commits, setCommits] = useState<any[]>([]);
  const [commitsTotal, setCommitsTotal] = useState(0);
  const [commitsPage, setCommitsPage] = useState(1);
  const [commitsTotalPages, setCommitsTotalPages] = useState(1);
  
  const [ciRuns, setCiRuns] = useState<any[]>([]);
  const [ciTotal, setCiTotal] = useState(0);
  const [ciPage, setCiPage] = useState(1);
  const [ciTotalPages, setCiTotalPages] = useState(1);

  const [prs, setPrs] = useState<any[]>([]);
  const [prsTotal, setPrsTotal] = useState(0);
  const [prsPage, setPrsPage] = useState(1);
  const [prsTotalPages, setPrsTotalPages] = useState(1);

  const [issues, setIssues] = useState<any[]>([]);
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [issuesPage, setIssuesPage] = useState(1);
  const [issuesTotalPages, setIssuesTotalPages] = useState(1);

  const [gitBranches, setGitBranches] = useState<any[]>([]);
  const [branchesTotal, setBranchesTotal] = useState(0);
  const [branchesPage, setBranchesPage] = useState(1);
  const [branchesTotalPages, setBranchesTotalPages] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [branchFilter, setBranchFilter] = useState('all');
  const [branchesList, setBranchesList] = useState<string[]>([]);
  const [commitsLinkedFilter, setCommitsLinkedFilter] = useState('all'); // all, true, false
  const [ciConclusionFilter, setCiConclusionFilter] = useState('all');
  const [prStateFilter, setPrStateFilter] = useState('all'); // all, open, closed, merged
  const [issueStateFilter, setIssueStateFilter] = useState('all'); // all, open, closed

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const data = await apiFetch(\`/workspaces/\${slug}/projects/\${key}/members\`);
        const members = data.members || [];
        const myMembership = members.find((m: any) => m.userId === currentUser?.userId);
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
        const data = await apiFetch(\`/workspaces/\${slug}/projects/\${key}/github/connection\`);
        setConnection(data.connection);
      } catch (err) {
        console.error('Failed to load GitHub connection', err);
      } finally {
        setIsConnLoading(false);
      }
    };
    if (slug && key) fetchConnection();
  }, [slug, key]);

  const fetchCommits = async (page = commitsPage) => {
    setIsLoading(true); setError(null);
    try {
      let url = \`/workspaces/\${slug}/projects/\${key}/github/commits?page=\${page}&limit=25\`;
      if (branchFilter !== 'all') url += \`&branch=\${encodeURIComponent(branchFilter)}\`;
      if (commitsLinkedFilter !== 'all') url += \`&linked=\${commitsLinkedFilter}\`;

      const res = await apiFetch(url);
      setCommits(res.commits || []); setCommitsTotal(res.totalCount || 0);
      setCommitsPage(res.page || 1); setCommitsTotalPages(res.totalPages || 1);
      setBranchesList(prev => Array.from(new Set([...prev, ...(res.branches || [])])));
    } catch (err: any) { setError(err.message || 'Failed to fetch commits'); } finally { setIsLoading(false); }
  };

  const fetchCiRuns = async (page = ciPage) => {
    setIsLoading(true); setError(null);
    try {
      let url = \`/workspaces/\${slug}/projects/\${key}/github/ci?page=\${page}&limit=25\`;
      if (branchFilter !== 'all') url += \`&branch=\${encodeURIComponent(branchFilter)}\`;
      if (ciConclusionFilter !== 'all') url += \`&conclusion=\${encodeURIComponent(ciConclusionFilter)}\`;

      const res = await apiFetch(url);
      setCiRuns(res.runs || []); setCiTotal(res.totalCount || 0);
      setCiPage(res.page || 1); setCiTotalPages(res.totalPages || 1);
      setBranchesList(prev => Array.from(new Set([...prev, ...(res.branches || [])])));
    } catch (err: any) { setError(err.message || 'Failed to fetch CI runs'); } finally { setIsLoading(false); }
  };

  const fetchPrs = async (page = prsPage) => {
    setIsLoading(true); setError(null);
    try {
      let url = \`/workspaces/\${slug}/projects/\${key}/github/pull-requests?page=\${page}&limit=25\`;
      if (prStateFilter !== 'all') url += \`&state=\${prStateFilter}\`;
      const res = await apiFetch(url);
      setPrs(res.pullRequests || []); setPrsTotal(res.totalCount || 0);
      setPrsPage(res.page || 1); setPrsTotalPages(res.totalPages || 1);
    } catch (err: any) { setError(err.message || 'Failed to fetch PRs'); } finally { setIsLoading(false); }
  };

  const fetchIssues = async (page = issuesPage) => {
    setIsLoading(true); setError(null);
    try {
      let url = \`/workspaces/\${slug}/projects/\${key}/github/issues?page=\${page}&limit=25\`;
      if (issueStateFilter !== 'all') url += \`&state=\${issueStateFilter}\`;
      const res = await apiFetch(url);
      setIssues(res.issues || []); setIssuesTotal(res.totalCount || 0);
      setIssuesPage(res.page || 1); setIssuesTotalPages(res.totalPages || 1);
    } catch (err: any) { setError(err.message || 'Failed to fetch Issues'); } finally { setIsLoading(false); }
  };

  const fetchBranches = async (page = branchesPage) => {
    setIsLoading(true); setError(null);
    try {
      const res = await apiFetch(\`/workspaces/\${slug}/projects/\${key}/github/branches\`);
      setGitBranches(res.branches || []); setBranchesTotal(res.branches?.length || 0);
    } catch (err: any) { setError(err.message || 'Failed to fetch branches'); } finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (!slug || !key) return;
    if (activeTab === 'commits') fetchCommits(1);
    else if (activeTab === 'prs') fetchPrs(1);
    else if (activeTab === 'issues') fetchIssues(1);
    else if (activeTab === 'branches') fetchBranches(1);
    else fetchCiRuns(1);
  }, [slug, key, activeTab, branchFilter, commitsLinkedFilter, ciConclusionFilter, prStateFilter, issueStateFilter]);

  const handleRefresh = () => {
    if (activeTab === 'commits') fetchCommits(commitsPage);
    else if (activeTab === 'prs') fetchPrs(prsPage);
    else if (activeTab === 'issues') fetchIssues(issuesPage);
    else if (activeTab === 'branches') fetchBranches(branchesPage);
    else fetchCiRuns(ciPage);
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
            to={\`/w/\${slug}/projects/\${key}/settings\`} 
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
            <p className="text-sm text-gray-400 mb-6">Track commits, pull requests, issues, branches and CI/CD pipelines connected to tasks.</p>
          </div>
          <div className="flex items-center space-x-4">
            {connection && (
              <a 
                href={\`https://github.com/\${connection.githubRepoFullName}\`}
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
              onClick={() => setActiveTab('commits')}
              className={\`pb-3 text-sm font-medium border-b-2 transition-colors \${activeTab === 'commits' ? 'border-white text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}\`}
            >
              Commits {commitsTotal > 0 && <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-xs">{commitsTotal}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('prs')}
              className={\`pb-3 text-sm font-medium border-b-2 transition-colors \${activeTab === 'prs' ? 'border-white text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}\`}
            >
              Pull Requests {prsTotal > 0 && <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-xs">{prsTotal}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('issues')}
              className={\`pb-3 text-sm font-medium border-b-2 transition-colors \${activeTab === 'issues' ? 'border-white text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}\`}
            >
              Issues {issuesTotal > 0 && <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-xs">{issuesTotal}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('branches')}
              className={\`pb-3 text-sm font-medium border-b-2 transition-colors \${activeTab === 'branches' ? 'border-white text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}\`}
            >
              Branches {branchesTotal > 0 && <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-xs">{branchesTotal}</span>}
            </button>
            <button 
              onClick={() => setActiveTab('ci')}
              className={\`pb-3 text-sm font-medium border-b-2 transition-colors \${activeTab === 'ci' ? 'border-white text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-200'}\`}
            >
              CI Runs {ciTotal > 0 && <span className="ml-1.5 bg-gray-800 text-gray-300 py-0.5 px-2 rounded-full text-xs">{ciTotal}</span>}
            </button>
          </div>

          <div className="flex items-center space-x-3 mb-2">
            {activeTab === 'commits' && (
              <select 
                value={commitsLinkedFilter}
                onChange={e => setCommitsLinkedFilter(e.target.value)}
                className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Commits</option>
                <option value="true">Linked to Task</option>
                <option value="false">Unlinked</option>
              </select>
            )}
            
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
              <select 
                value={prStateFilter}
                onChange={e => setPrStateFilter(e.target.value)}
                className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All PRs</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="merged">Merged</option>
              </select>
            )}

            {activeTab === 'issues' && (
              <select 
                value={issueStateFilter}
                onChange={e => setIssueStateFilter(e.target.value)}
                className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Issues</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            )}
            
            {(activeTab === 'commits' || activeTab === 'ci') && (
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
        ) : activeTab === 'commits' ? (
          <div className="space-y-4 max-w-5xl">
            {commits.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl bg-gray-900/30">
                <GitCommit className="w-10 h-10 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-300 mb-1">No commits found</h3>
                <p className="text-gray-500 mb-4">
                  {connection ? \`Commits will appear here when you push to \${connection.githubRepoFullName}\` : 'Connect a repository to see commits.'}
                </p>
              </div>
            ) : (
              <>
                <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-900/80 border-b border-gray-800 text-xs font-semibold text-gray-400 tracking-wider">
                        <th className="px-4 py-3 w-24">SHA</th>
                        <th className="px-4 py-3">Message</th>
                        <th className="px-4 py-3 w-32">Task</th>
                        <th className="px-4 py-3 w-40">Author</th>
                        <th className="px-4 py-3 w-40">Branch</th>
                        <th className="px-4 py-3 w-32">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {commits.map(commit => (
                        <tr key={commit.id} className="hover:bg-gray-800/30 transition-colors group">
                          <td className="px-4 py-3">
                            <a href={commit.url} target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-400 hover:underline flex items-center">
                              <GitCommit className="w-3.5 h-3.5 mr-1 text-gray-500" />
                              {commit.commitSha?.substring(0, 7)}
                            </a>
                          </td>
                          <td className="px-4 py-3"><span className="text-sm font-medium text-gray-200 line-clamp-1">{commit.messageHeadline}</span></td>
                          <td className="px-4 py-3">
                            {commit.taskId ? (
                              <Link to={\`/w/\${slug}/projects/\${key}/tasks/\${commit.taskKey}\`} className="inline-flex bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded transition-colors">{commit.taskKey}</Link>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="px-4 py-3"><span className="text-sm text-gray-400 truncate">{commit.authorGithubLogin || 'Unknown'}</span></td>
                          <td className="px-4 py-3"><span className="font-mono text-xs text-gray-400">{commit.branchName || '—'}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDistanceToNow(new Date(commit.committedAt), { addSuffix: true })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {commitsTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <span className="text-sm text-gray-500">Showing {(commitsPage - 1) * 25 + 1} to {Math.min(commitsPage * 25, commitsTotal)} of {commitsTotal}</span>
                    <div className="flex space-x-2">
                      <button onClick={() => fetchCommits(commitsPage - 1)} disabled={commitsPage === 1} className="p-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-white disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
                      <button onClick={() => fetchCommits(commitsPage + 1)} disabled={commitsPage === commitsTotalPages} className="p-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-white disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                  </div>
                )}
              </>
            )}
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
                      <tr key={pr.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-gray-400">#{pr.prNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-200">{pr.title}</td>
                        <td className="px-4 py-3">
                          {pr.state === 'open' && <span className="text-green-400 text-xs px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">Open</span>}
                          {pr.state === 'merged' && <span className="text-purple-400 text-xs px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full">Merged</span>}
                          {pr.state === 'closed' && <span className="text-red-400 text-xs px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-full">Closed</span>}
                        </td>
                        <td className="px-4 py-3">
                          {pr.taskId ? <Link to={\`/w/\${slug}/projects/\${key}/tasks/\${pr.taskKey}\`} className="inline-flex bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded transition-colors">{pr.taskKey}</Link> : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {pr.headBranch} → {pr.baseBranch}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pr.htmlUrl && <a href={pr.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex text-gray-400 hover:text-white"><ExternalLink className="w-4 h-4" /></a>}
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
                      <th className="px-4 py-3 w-24">Issue</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3 w-32">Status</th>
                      <th className="px-4 py-3 w-32">Task</th>
                      <th className="px-4 py-3 w-24 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {issues.map(issue => (
                      <tr key={issue.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-gray-400">#{issue.githubIssueNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-200">{issue.title}</td>
                        <td className="px-4 py-3">
                          {issue.state === 'open' ? <span className="text-green-400 text-xs px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">Open</span> : <span className="text-red-400 text-xs px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-full">Closed</span>}
                        </td>
                        <td className="px-4 py-3">
                          {issue.taskId ? <Link to={\`/w/\${slug}/projects/\${key}/tasks/\${issue.taskKey}\`} className="inline-flex bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded transition-colors">{issue.taskKey}</Link> : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {issue.htmlUrl && <a href={issue.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex text-gray-400 hover:text-white"><ExternalLink className="w-4 h-4" /></a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'branches' ? (
          <div className="space-y-4 max-w-5xl">
            {gitBranches.length === 0 && !isLoading ? (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl bg-gray-900/30">
                <GitBranch className="w-10 h-10 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-300 mb-1">No branches found</h3>
              </div>
            ) : (
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-900/80 border-b border-gray-800 text-xs font-semibold text-gray-400 tracking-wider">
                      <th className="px-4 py-3">Branch Name</th>
                      <th className="px-4 py-3 w-32">Status</th>
                      <th className="px-4 py-3 w-32">Task</th>
                      <th className="px-4 py-3 w-24 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {gitBranches.map(branch => (
                      <tr key={branch.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-gray-200">{branch.branchName}</td>
                        <td className="px-4 py-3">
                          {!branch.isDeleted ? <span className="text-green-400 text-xs px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full">Active</span> : <span className="text-gray-400 text-xs px-2 py-1 bg-gray-500/10 border border-gray-500/20 rounded-full">Deleted</span>}
                        </td>
                        <td className="px-4 py-3">
                          {branch.taskId ? <Link to={\`/w/\${slug}/projects/\${key}/tasks/\${branch.taskKey}\`} className="inline-flex bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded transition-colors">{branch.taskKey}</Link> : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {branch.htmlUrl && <a href={branch.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex text-gray-400 hover:text-white"><ExternalLink className="w-4 h-4" /></a>}
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
                                onClick={async () => {
                                  try {
                                    await apiFetch(\`/workspaces/\${slug}/projects/\${key}/github/ci/\${run.runId}/rerun\`, { method: 'POST' });
                                    fetchCiRuns(ciPage);
                                  } catch (e: any) { alert(e.message); }
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 px-2 py-1 rounded bg-blue-500/10 transition-colors"
                              >
                                Re-run
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
    </div>
  );
};
`;

fs.writeFileSync('src/pages/projects/GitHubIntegration.tsx', newContent, 'utf8');
console.log('GitHubIntegration.tsx has been updated with the 5 new tabs!');
