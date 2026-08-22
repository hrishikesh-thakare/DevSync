import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, AlertTriangle, GitBranch, Loader2, CheckCircle2, Tag, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { supabase } from '../../lib/supabase.js';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { useLabelStore } from '../../store/labelStore.js';
import type { ProjectMember } from '../../store/boardStore.js';
import { DEFAULT_LABEL_COLOR, assertContrast, readableText } from '@/theme/colors';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

/**
 * The fields of `GET �/github/connection` this panel reads. `GitHubIntegration`
 * declares a wider version of the same row for its own view; kept local here so
 * neither page has to import the other's internals.
 */
interface GithubConnection {
  githubRepoFullName: string;
  defaultBranch?: string;
  connectedByName?: string;
}

/** A repo from `GET /github/user/repos`, as the picker below renders it. */
interface GithubRepo {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  private: boolean;
}

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
  const [githubConnection, setGithubConnection] = useState<GithubConnection | null>(null);
  const [githubLoading, setGithubLoading] = useState(true);
  
  // New OAuth State
  const [isGithubAuthorized, setIsGithubAuthorized] = useState(false);
  const [userRepos, setUserRepos] = useState<GithubRepo[]>([]);
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
  const [newLabelColor, setNewLabelColor] = useState(DEFAULT_LABEL_COLOR);
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
        const myMembership = members.find((m: ProjectMember) => m.userId === currentUser?.userId);
        
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
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : '';
          if (message.includes('not connected') || message.includes('expired')) {
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the project. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!(await confirm('This project will be read-only. Members can still view but not edit. Proceed?'))) return;
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/archive`, { method: 'PATCH' });
      navigate(`/w/${slug}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't archive the project. Try again in a moment.");
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't start GitHub authorization. Try again in a moment.");
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't connect repository. Try again in a moment.");
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't disconnect repository. Try again in a moment.");
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't disconnect personal GitHub account. Try again in a moment.");
    }
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim() || !slug || !key) return;
    setIsCreatingLabel(true);
    try {
      await createLabel(slug, key, newLabelName.trim(), newLabelColor);
      setNewLabelName('');
      setNewLabelColor(DEFAULT_LABEL_COLOR);
      toast.success('Label created.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't create label. Try again in a moment.");
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename label. Try again in a moment.");
    }
  };

  const handleRecolorLabel = async (labelId: string, color: string) => {
    if (!slug || !key) return;
    try {
      await updateLabel(slug, key, labelId, { color });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the label colour. Try again in a moment.");
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!slug || !key) return;
    if (!(await confirm({ message: 'Delete this label? It will be removed from every task that uses it.', isDestructive: true }))) return;
    try {
      await deleteLabel(slug, key, labelId);
      toast.success('Label deleted.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete label. Try again in a moment.");
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-background text-foreground">
      <div className="max-w-3xl">
        <h1 className="text-h1 font-[590] text-foreground mb-8">Project Settings</h1>

        <Card className="[--card-spacing:--spacing(6)] bg-elevated/50 border border-border mb-8">
          <h2 className="text-h2 font-[590] text-foreground mb-6">General Details</h2>

          <div className="space-y-6">
            <div>
              <Label htmlFor="projectsettings-project-name" className="block text-ui font-[510] text-muted-foreground mb-1.5">Project Name</Label>
              <Input 
                id="projectsettings-project-name"
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div>
              <Label htmlFor="projectsettings-project-key" className="block text-ui font-[510] text-muted-foreground mb-1.5">Project Key</Label>
              <Input 
                id="projectsettings-project-key"
                type="text" 
                value={key}
                disabled
                className="w-full bg-muted px-4 py-2.5 text-subtle-foreground cursor-not-allowed font-mono"
              />
              <p className="text-caption text-subtle-foreground mt-2">The project key is immutable after creation.</p>
            </div>

            <div>
              <Label htmlFor="projectsettings-description" className="block text-ui font-[510] text-muted-foreground mb-1.5">Description</Label>
              <Textarea 
                id="projectsettings-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={isSaving} className="flex items-center px-5 py-2.5" variant="primary" size="default">
                <Save className="w-4 h-4 mr-2" strokeWidth={1.75} />
                {isSaving ? 'Saving...' : 'Save Details'}
              </Button>
            </div>
          </div>
        </Card>

        {/* GitHub Connection Section */}
        <Card className="[--card-spacing:--spacing(6)] bg-elevated/50 border border-border mb-8">
          <h2 className="text-h2 font-[590] text-foreground mb-2 flex items-center">
            <GitBranch className="w-5 h-5 mr-2 text-muted-foreground" strokeWidth={1.75} />
            GitHub Connection
          </h2>
          <p className="text-ui text-muted-foreground mb-6">Link this project to a GitHub repository to track commits and CI/CD status on your tasks.</p>
          
          {githubLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : githubConnection ? (
            <div className="bg-background border border-border rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-h3 font-[590] text-foreground">
                      <a href={`https://github.com/${githubConnection.githubRepoFullName}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {githubConnection.githubRepoFullName}
                      </a>
                    </h3>
                    <Badge variant="success" className="">
                      <CheckCircle2 className="w-3 h-3 mr-1" strokeWidth={1.75} /> Active
                    </Badge>
                  </div>
                  <div className="space-y-1 text-ui text-muted-foreground">
                    <p>Default Branch: <span className="font-mono text-foreground">{githubConnection.defaultBranch}</span></p>
                    <p>Connected by {githubConnection.connectedByName || 'a user'}</p>
                  </div>
                </div>
                <Button 
                  onClick={handleDisconnectGithub} 
                  disabled={isDisconnecting}
                  className="px-4 py-2 border border-danger-border text-danger hover:bg-danger-muted disabled:text-disabled"
                  variant="destructive" size="default"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-background border border-border rounded-lg p-5 space-y-4">
              {!isGithubAuthorized ? (
                <div className="text-center py-4">
                  <GitBranch className="w-12 h-12 text-subtle-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
                  <h3 className="text-h3 font-[590] text-foreground mb-2">Connect your GitHub Account</h3>
                  <p className="text-ui text-muted-foreground mb-6 max-w-md mx-auto">
                    Authorize DevSync to access your GitHub repositories to quickly link them to this project.
                  </p>
                  <Button 
                    onClick={handleAuthorizeGithub}
                    className="inline-flex items-center px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary-hover"
                    variant="primary" size="default"
                  >
                    Authorize with GitHub
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="projectsettings-select-a-repository" className="block text-ui font-[510] text-muted-foreground mb-1.5">Select a Repository</Label>
                    {isFetchingRepos ? (
                      <div className="flex items-center space-x-2 text-ui text-muted-foreground p-2">
                        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                        <span>Fetching your repositories...</span>
                      </div>
                    ) : (
                      <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                        <SelectTrigger id="projectsettings-select-a-repository" className="w-full bg-elevated">
                          <SelectValue placeholder="-- Choose a repository --" />
                        </SelectTrigger>
                        <SelectContent>
                          {userRepos.map(repo => (
                            <SelectItem key={repo.id} value={repo.fullName}>
                              {repo.fullName} {repo.private ? '(Private)' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <Button 
                      onClick={handleConnectGithub} 
                      disabled={isConnecting || !selectedRepo}
                      className="flex items-center px-4 py-2 bg-primary text-primary-foreground hover:bg-primary-hover disabled:text-disabled disabled:cursor-not-allowed"
                      variant="primary" size="default"
                    >
                      {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.75} />}
                      {isConnecting ? 'Connecting...' : 'Link Repository'}
                    </Button>
                    <div className="flex flex-col items-end space-y-2">
                      <Button 
                        onClick={handleAuthorizeGithub}
                        className="text-caption text-subtle-foreground hover:text-foreground transition-colors"
                        variant="ghost" size="default"
                      >
                        Refresh Repositories
                      </Button>
                      <Button 
                        onClick={handleDisconnectUserGithub}
                        className="text-caption text-danger/80 hover:text-danger transition-colors"
                        variant="destructive" size="default"
                      >
                        Disconnect GitHub Account
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="border border-border bg-elevated/50 rounded-lg p-6 mb-8">
          <h2 className="text-h2 font-[590] text-foreground mb-2 flex items-center">
            <Tag className="w-5 h-5 mr-2" strokeWidth={1.75} />
            Labels
          </h2>
          <p className="text-muted-foreground text-ui mb-6">
            Labels are shared across the project. Renaming a label updates every task that uses it; colors apply everywhere a label appears.
          </p>

          <form onSubmit={handleCreateLabel} className="flex items-center gap-2 mb-5">
            <Input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="New label name"
              maxLength={50}
              className="flex-1 bg-background px-3 py-2 text-foreground text-ui"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Native color picker: no shadcn primitive exists for `type="color"`,
                    and routing it through `Input` would apply text-field padding and
                    height that fight the browser's swatch rendering. Deliberate exception. */}
                <input
                  type="color"
                  aria-label="Label color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-9 h-9 rounded-md bg-background border border-border cursor-pointer p-1"
                />
              </TooltipTrigger>
              <TooltipContent>Label color</TooltipContent>
            </Tooltip>
            <Button
              type="submit"
              disabled={isCreatingLabel || !newLabelName.trim()}
              className="flex items-center px-4 py-2 bg-primary text-primary-foreground hover:bg-primary-hover disabled:text-disabled disabled:cursor-not-allowed"
              variant="primary" size="default"
            >
              {isCreatingLabel ? <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.75} /> : <Plus className="w-4 h-4 mr-2" strokeWidth={1.75} />}
              Add
            </Button>
          </form>

          <div className="space-y-2">
            {labels.length === 0 ? (
              <p className="text-ui text-subtle-foreground">No labels yet. Labels can also be added directly when creating or editing tasks.</p>
            ) : (
              labels.map((label) => (
                <div key={label.labelId} className="flex items-center gap-3 p-3 bg-background">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* Native color picker � deliberate exception, see above. */}
                      <input
                        type="color"
                        aria-label={`Change color of label ${label.name}`}
                        value={label.color}
                        onChange={(e) => handleRecolorLabel(label.labelId, e.target.value)}
                        className="w-8 h-8 rounded-md bg-transparent border border-border cursor-pointer p-0.5"
                      />
                    </TooltipTrigger>
                    <TooltipContent>Change color</TooltipContent>
                  </Tooltip>
                  {editingLabelId === label.labelId ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        maxLength={50}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameLabel(label.labelId); if (e.key === 'Escape') setEditingLabelId(null); }}
                        className="flex-1 bg-background px-3 py-1.5 text-foreground text-ui"
                      />
                      <Button onClick={() => handleRenameLabel(label.labelId)} className="text-caption text-primary hover:text-primary-hover font-[590]" variant="ghost" size="default">
                        Save
                      </Button>
                      <Button onClick={() => setEditingLabelId(null)} className="text-caption text-subtle-foreground hover:text-foreground" variant="ghost" size="default">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* §10: "Don't render a DB-supplied label colour raw."
                          The stored hex goes through assertContrast (lift until
                          the chip clears 3:1 on --bg-surface) and readableText
                          (pick the text token that clears 4.5:1 on it) — the
                          same guards LabelChip uses at every other call site. */}
                      {(() => {
                        const swatch = assertContrast(label.color || DEFAULT_LABEL_COLOR);
                        return (
                          <span
                            className="inline-flex items-center text-caption px-2 py-0.5 rounded-full font-[510]"
                            style={{ backgroundColor: swatch, color: readableText(swatch) }}
                          >
                            {label.name}
                          </span>
                        );
                      })()}
                      <span className="text-caption text-subtle-foreground">{label.usageCount} task{label.usageCount === 1 ? '' : 's'}</span>
                      <div className="flex-1" />
                      <Button
                        onClick={() => { setEditingLabelId(label.labelId); setEditingName(label.name); }}
                        className="text-caption text-muted-foreground hover:text-foreground font-[590]"
                        variant="ghost" size="default"
                      >
                        Rename
                      </Button>
                      <Button
                        onClick={() => handleDeleteLabel(label.labelId)}
                        className="text-caption text-danger/80 hover:text-danger font-[590] flex items-center"
                        variant="destructive" size="default"
                      >
                        <Trash2 className="w-4 h-4 mr-1" strokeWidth={1.75} /> Delete
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border border-danger-border bg-danger-muted rounded-lg p-6">
          <h2 className="text-h2 font-[590] text-danger mb-2 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" strokeWidth={1.75} />
            Danger Zone
          </h2>
          <p className="text-muted-foreground text-ui mb-6">
            Archiving a project makes it read-only. Deleting a project permanently removes all tasks, sprints, and data.
          </p>
          
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between p-4 bg-background border border-danger-border rounded-lg">
              <div>
                <h4 className="font-[590] text-foreground">Archive Project</h4>
                <p className="text-caption text-subtle-foreground">Freeze all activity. Can be restored later.</p>
              </div>
              <Button onClick={handleArchive} className="px-4 py-2 border border-danger-border text-danger hover:bg-danger-muted" variant="destructive" size="default">
                Archive Project
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
