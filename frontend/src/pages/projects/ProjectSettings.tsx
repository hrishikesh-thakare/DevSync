import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, AlertTriangle, GitBranch, Loader2, CheckCircle2, Tag, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { supabase } from '../../lib/supabase.js';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { useLabelStore } from '../../store/labelStore.js';
export const ProjectSettings = () => {
  const { slug, key } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // GitHub Connection State
  const [githubConnection, setGithubConnection] = useState<any>(null);
  const [githubLoading, setGithubLoading] = useState(true);
  
  // New OAuth State
  const [isGithubAuthorized, setIsGithubAuthorized] = useState(false);
  const [userRepos, setUserRepos] = useState<any[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('');
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Label management state
  const labels = useLabelStore(state => state.labels);
  const fetchLabels = useLabelStore(state => state.fetchLabels);
  const createLabel = useLabelStore(state => state.createLabel);
  const updateLabel = useLabelStore(state => state.updateLabel);
  const deleteLabel = useLabelStore(state => state.deleteLabel);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#64748b');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const data = await apiFetch(`/workspaces/${slug}/projects/${key}`);
        setName(data.project.name || '');
        setDescription(data.project.description || '');

        // RBAC Guard: Verify project_admin or workspace admin
        const { useCurrentWorkspaceStore } = await import('../../store/currentWorkspace.js');
        const { useAuthStore } = await import('../../store/auth.js');
        const isAdmin = useCurrentWorkspaceStore.getState().isAdmin();
        const currentUser = useAuthStore.getState().user;

        const membersData = await apiFetch(`/workspaces/${slug}/projects/${key}/members`);
        const members = membersData.members || [];
        const myMembership = members.find((m: any) => m.userId === currentUser?.userId);
        
        if (!isAdmin && myMembership?.role !== 'project_admin') {
          navigate(`/w/${slug}/projects/${key}`, { replace: true });
        }

        // Load GitHub Connection
        try {
          const ghData = await apiFetch(`/workspaces/${slug}/projects/${key}/github/connection`);
          setGithubConnection(ghData.connection);
        } catch (err) {
          console.error('Failed to load GitHub connection', err);
        } finally {
          setGithubLoading(false);
        }

        // Load User Repos (if authorized)
        try {
          setIsFetchingRepos(true);
          const reposData = await apiFetch(`/github/user/repos`);
          setUserRepos(reposData.repos);
          setIsGithubAuthorized(true);
        } catch (err: any) {
          if (err.message && (err.message.includes('not connected') || err.message.includes('expired'))) {
            setIsGithubAuthorized(false);
          } else {
            console.error('Failed to fetch user repos', err);
          }
        } finally {
          setIsFetchingRepos(false);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    if (slug && key) {
      loadProject();
      fetchLabels(slug, key);
    }
  }, [slug, key, navigate, fetchLabels]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description }),
      });
      toast.success('Project updated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update project.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!(await confirm('This project will be read-only. Members can still view but not edit. Proceed?'))) return;
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/archive`, { method: 'PATCH' });
      navigate(`/w/${slug}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to archive project.');
    }
  };

  const handleAuthorizeGithub = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          scopes: 'repo admin:repo_hook',
          redirectTo: `${window.location.origin}/github/callback?returnTo=/w/${slug}/projects/${key}/settings`,
          queryParams: {
            prompt: 'consent',
          }
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || 'Failed to start GitHub authorization');
    }
  };

  const handleConnectGithub = async () => {
    if (!selectedRepo) {
      toast.error('Please select a repository.');
      return;
    }
    const repo = userRepos.find(r => r.fullName === selectedRepo);
    if (!repo) return;

    setIsConnecting(true);
    try {
      const res = await apiFetch(`/workspaces/${slug}/projects/${key}/github/connect`, {
        method: 'POST',
        body: JSON.stringify({
          repo_owner: repo.owner,
          repo_name: repo.name,
        }),
      });
      setGithubConnection(res.connection);
      setSelectedRepo('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect repository.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGithub = async () => {
    if (!(await confirm('This will delete the webhook from GitHub and stop tracking new commits and CI runs. Existing data will be preserved. Proceed?'))) return;
    setIsDisconnecting(true);
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/github/disconnect`, {
        method: 'DELETE',
      });
      setGithubConnection(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect repository.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleDisconnectUserGithub = async () => {
    if (!(await confirm('This will disconnect your personal GitHub account from DevSync. Proceed?'))) return;
    try {
      await apiFetch(`/github/user/disconnect`, { method: 'DELETE' });
      setIsGithubAuthorized(false);
      setUserRepos([]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect personal GitHub account.');
    }
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim() || !slug || !key) return;
    setIsCreatingLabel(true);
    try {
      await createLabel(slug, key, newLabelName.trim(), newLabelColor);
      setNewLabelName('');
      setNewLabelColor('#64748b');
      toast.success('Label created.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create label.');
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const handleRenameLabel = async (labelId: string) => {
    if (!editingName.trim() || !slug || !key) return;
    try {
      await updateLabel(slug, key, labelId, { name: editingName.trim() });
      setEditingLabelId(null);
      toast.success('Label renamed across all tasks.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename label.');
    }
  };

  const handleRecolorLabel = async (labelId: string, color: string) => {
    if (!slug || !key) return;
    try {
      await updateLabel(slug, key, labelId, { color });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update label color.');
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!slug || !key) return;
    if (!(await confirm({ message: 'Delete this label? It will be removed from every task that uses it.', isDestructive: true }))) return;
    try {
      await deleteLabel(slug, key, labelId);
      toast.success('Label deleted.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete label.');
    }
  };

  if (isLoading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-gray-950 text-gray-200">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-white mb-8">Project Settings</h1>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-6">General Details</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Project Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Project Key</label>
              <input 
                type="text" 
                value={key}
                disabled
                className="w-full bg-gray-950/50 border border-gray-800 rounded-lg px-4 py-2.5 text-gray-500 cursor-not-allowed font-mono"
              />
              <p className="text-xs text-gray-500 mt-2">The project key is immutable after creation.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
              <textarea 
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-all"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-800/60">
              <button onClick={handleSave} disabled={isSaving} className="flex items-center px-5 py-2.5 bg-gray-400 hover:bg-white text-white text-sm font-bold rounded-lg transition-colors">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </div>
        </div>

        {/* GitHub Connection Section */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center">
            <GitBranch className="w-5 h-5 mr-2 text-gray-400" />
            GitHub Connection
          </h2>
          <p className="text-sm text-gray-400 mb-6">Link this project to a GitHub repository to track commits and CI/CD status on your tasks.</p>
          
          {githubLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          ) : githubConnection ? (
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-200">
                      <a href={`https://github.com/${githubConnection.githubRepoFullName}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {githubConnection.githubRepoFullName}
                      </a>
                    </h3>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5 rounded-full flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-400">
                    <p>Default Branch: <span className="font-mono text-gray-300">{githubConnection.defaultBranch}</span></p>
                    <p>Connected by {githubConnection.connectedByName || 'a user'}</p>
                  </div>
                </div>
                <button 
                  onClick={handleDisconnectGithub} 
                  disabled={isDisconnecting}
                  className="px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-5 space-y-4">
              {!isGithubAuthorized ? (
                <div className="text-center py-4">
                  <GitBranch className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-gray-200 mb-2">Connect your GitHub Account</h3>
                  <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
                    Authorize DevSync to access your GitHub repositories to quickly link them to this project.
                  </p>
                  <button 
                    onClick={handleAuthorizeGithub}
                    className="inline-flex items-center px-5 py-2.5 bg-white text-gray-950 hover:bg-gray-200 text-sm font-bold rounded-lg transition-colors"
                  >
                    Authorize with GitHub
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Select a Repository</label>
                    {isFetchingRepos ? (
                      <div className="flex items-center space-x-2 text-sm text-gray-400 p-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Fetching your repositories...</span>
                      </div>
                    ) : (
                      <select 
                        value={selectedRepo}
                        onChange={(e) => setSelectedRepo(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-white/50"
                      >
                        <option value="">-- Choose a repository --</option>
                        {userRepos.map(repo => (
                          <option key={repo.id} value={repo.fullName}>
                            {repo.fullName} {repo.private ? '(Private)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <button 
                      onClick={handleConnectGithub} 
                      disabled={isConnecting || !selectedRepo}
                      className="flex items-center px-4 py-2 bg-white text-gray-950 hover:bg-gray-200 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {isConnecting ? 'Connecting...' : 'Link Repository'}
                    </button>
                    <div className="flex flex-col items-end space-y-2">
                      <button 
                        onClick={handleAuthorizeGithub}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Refresh Repositories
                      </button>
                      <button 
                        onClick={handleDisconnectUserGithub}
                        className="text-xs text-red-500/80 hover:text-red-400 transition-colors"
                      >
                        Disconnect GitHub Account
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border border-gray-800 bg-gray-950/50 rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-100 mb-2 flex items-center">
            <Tag className="w-5 h-5 mr-2" />
            Labels
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Labels are shared across the project. Renaming a label updates every task that uses it; colors apply everywhere a label appears.
          </p>

          <form onSubmit={handleCreateLabel} className="flex items-center gap-2 mb-5">
            <input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="New label name"
              maxLength={50}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/50"
            />
            <input
              type="color"
              value={newLabelColor}
              onChange={(e) => setNewLabelColor(e.target.value)}
              className="w-9 h-9 rounded-lg bg-gray-900 border border-gray-800 cursor-pointer p-1"
              title="Label color"
            />
            <button
              type="submit"
              disabled={isCreatingLabel || !newLabelName.trim()}
              className="flex items-center px-4 py-2 bg-white text-gray-950 hover:bg-gray-200 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingLabel ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add
            </button>
          </form>

          <div className="space-y-2">
            {labels.length === 0 ? (
              <p className="text-sm text-gray-500">No labels yet. Labels can also be added directly when creating or editing tasks.</p>
            ) : (
              labels.map((label) => (
                <div key={label.labelId} className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
                  <input
                    type="color"
                    value={label.color}
                    onChange={(e) => handleRecolorLabel(label.labelId, e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent border border-gray-800 cursor-pointer p-0.5"
                    title="Change color"
                  />
                  {editingLabelId === label.labelId ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        maxLength={50}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameLabel(label.labelId); if (e.key === 'Escape') setEditingLabelId(null); }}
                        className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                      />
                      <button onClick={() => handleRenameLabel(label.labelId)} className="text-xs text-gray-300 hover:text-white font-semibold">
                        Save
                      </button>
                      <button onClick={() => setEditingLabelId(null)} className="text-xs text-gray-500 hover:text-gray-300">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className="inline-flex items-center text-xs px-2 py-0.5 rounded border font-medium"
                        style={{ backgroundColor: `${label.color}22`, borderColor: `${label.color}66`, color: label.color }}
                      >
                        {label.name}
                      </span>
                      <span className="text-xs text-gray-500">{label.usageCount} task{label.usageCount === 1 ? '' : 's'}</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => { setEditingLabelId(label.labelId); setEditingName(label.name); }}
                        className="text-xs text-gray-400 hover:text-gray-200 font-semibold"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDeleteLabel(label.labelId)}
                        className="text-xs text-red-500/80 hover:text-red-400 font-semibold flex items-center"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-6">
          <h2 className="text-lg font-bold text-red-500 mb-2 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Danger Zone
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Archiving a project makes it read-only. Deleting a project permanently removes all tasks, sprints, and data.
          </p>
          
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-950 border border-red-500/20 rounded-lg">
              <div>
                <h4 className="font-semibold text-gray-200">Archive Project</h4>
                <p className="text-xs text-gray-500">Freeze all activity. Can be restored later.</p>
              </div>
              <button onClick={handleArchive} className="px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 text-sm font-bold rounded-lg transition-colors">
                Archive Project
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
