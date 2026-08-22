import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../../store/workspaceStore.js';
import { useAuthStore } from '../../store/auth.js';
import { Plus, Briefcase, ChevronRight, LogOut, Loader2, ServerCrash } from 'lucide-react';
import { useToast } from '../../hooks/useToast.js';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export const WorkspaceList = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { workspaces, isLoading, fetchWorkspaces, createWorkspace, acceptInvite } = useWorkspaceStore();
  const [acceptingSlug, setAcceptingSlug] = useState<string | null>(null);
  const toast = useToast();

  const [isCreating, setIsCreating] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsSlug, setNewWsSlug] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName || !newWsSlug) return;
    
    setCreateLoading(true);
    try {
      await createWorkspace(newWsName, newWsSlug);
      setIsCreating(false);
      setNewWsName('');
      setNewWsSlug('');
      navigate(`/w/${newWsSlug}`);
    } catch (err) {
      console.error('Error creating workspace', err);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary-muted">
      {/* Top Navbar */}
      <nav className="border-b border-border bg-card sticky top-0 z-(--z-sticky)">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-muted border border-primary-border flex items-center justify-center">
              <ServerCrash className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight">Dev<span className="text-primary">Sync</span></span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline-block">
              Signed in as <strong className="text-foreground">{user?.email}</strong>
            </span>
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => logout()}
                  variant="ghost"
                  size="icon"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-hover rounded-md transition-colors h-auto w-auto"
                  aria-label="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sign out</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground mb-2">Welcome back, {user?.fullName?.split(' ')[0] || 'Developer'}</h1>
            <p className="text-muted-foreground">Select a workspace to enter your team's hub.</p>
          </div>

          <Button
            onClick={() => setIsCreating(!isCreating)}
            variant="default"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold rounded-md transition-colors duration-200 shadow-sm h-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Workspace
          </Button>
        </div>

        {/* Creation Form Collapse */}
        {isCreating && (
          <div className="mb-10 bg-card border border-border rounded-lg p-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="text-lg font-bold text-foreground mb-4">Create New Workspace</h3>
            <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Workspace Name (e.g. Acme Corp)"
                  value={newWsName}
                  onChange={(e) => {
                    setNewWsName(e.target.value);
                    // Auto-generate slug
                    setNewWsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                  }}
                  className="w-full px-4 py-3 bg-background border border-border rounded-md focus:ring-2 focus:ring-ring focus:border-ring transition-colors h-auto"
                  required
                />
              </div>
              <div className="flex-1">
                <div className="flex bg-background border border-border rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-colors overflow-hidden">
                  <span className="flex items-center px-4 bg-muted text-subtle-foreground text-sm border-r border-border">
                    devsync.com/w/
                  </span>
                  <Input
                    type="text"
                    placeholder="acme-corp"
                    value={newWsSlug}
                    onChange={(e) => setNewWsSlug(e.target.value)}
                    className="w-full px-4 py-3 bg-transparent border-none outline-none text-foreground h-auto"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={createLoading}
                variant="default"
                className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-md hover:bg-primary-hover transition-colors disabled:opacity-70 flex items-center justify-center min-w-[120px] h-auto"
              >
                {createLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create'}
              </Button>
            </form>
          </div>
        )}

        {/* Workspace Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-lg border-dashed">
            <Briefcase className="w-12 h-12 text-subtle-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">No workspaces yet</h3>
            <p className="text-subtle-foreground mt-1">Create one or ask your admin for an invite.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((ws) => (
              <Button
                key={ws.workspaceId}
                onClick={() => {
                  if (ws.state === 'active') navigate(`/w/${ws.slug}`);
                }}
                variant="secondary"
                className={`group relative flex flex-col text-left bg-card hover:bg-hover border border-border hover:border-border-strong rounded-lg p-6 transition-all duration-300 hover:shadow-md overflow-hidden h-auto ${ws.state === 'active' ? 'hover:-translate-y-1' : ''}`}
              >
                {/* Corner wash on hover — flat primary tint, no gradient (§5). */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-muted opacity-0 group-hover:opacity-100 rounded-bl-full transition-opacity duration-500" aria-hidden="true" />

                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center text-xl font-bold text-foreground group-hover:scale-110 transition-transform duration-300">
                    {ws.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex items-center space-x-2">
                    {ws.state === 'invited' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning-muted text-warning border border-warning-border">
                        Pending Invite
                      </span>
                    )}
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      ws.role === 'owner' ? 'bg-primary-muted text-primary border-primary-border' :
                      ws.role === 'admin' ? 'bg-primary-muted text-primary border-primary-border' :
                      'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {ws.role.charAt(0).toUpperCase() + ws.role.slice(1)}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {ws.name}
                </h3>
                <p className="text-sm text-subtle-foreground mt-1 mb-6">
                  devsync.com/w/{ws.slug}
                </p>

                <div className="mt-auto">
                  {ws.state === 'invited' ? (
                    <Button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        setAcceptingSlug(ws.slug);
                        try {
                          await acceptInvite(ws.slug);
                          navigate(`/w/${ws.slug}`);
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : 'Failed to accept invite');
                          setAcceptingSlug(null);
                        }
                      }}
                      disabled={acceptingSlug === ws.slug}
                      variant="default"
                      className="w-full py-2 bg-success-muted hover:bg-success-muted/80 text-success font-bold rounded-md transition-colors border border-success-border flex items-center justify-center h-auto"
                    >
                      {acceptingSlug === ws.slug ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Accept Invite
                    </Button>
                  ) : (
                    <div className="flex items-center text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                      Enter Workspace
                      <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
