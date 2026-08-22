import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { Play, CheckCircle2, Calendar, Target, Loader2, Plus, Trash2, Sparkles } from 'lucide-react';

import { format } from 'date-fns';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Sprint {
  sprintId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: 'future' | 'active' | 'closed';
  capacityPoints: number | null;
  stats?: { taskCount: number; totalPoints: number; completedPoints: number };
  aiSummary?: { summary: string; highlights?: string[]; generatedAt?: string } | null;
  aiContributionReport?: Array<{ userId?: string | null; fullName: string; summary: string; tasksCompleted: number }> | null;
}

export const SprintList = () => {
  const { slug, key } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canManageSprint, setCanManageSprint] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newCapacityPoints, setNewCapacityPoints] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Start modal
  const [showStartModal, setShowStartModal] = useState<Sprint | null>(null);
  const [startDate, setStartDate] = useState('');
  const [startEndDate, setStartEndDate] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  // Close modal
  const [showCloseModal, setShowCloseModal] = useState<Sprint | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Inline capacity editing
  const [capacityDrafts, setCapacityDrafts] = useState<Record<string, string>>({});

  const saveCapacity = async (sprintId: string) => {
    const value = capacityDrafts[sprintId];
    if (value === undefined) return;
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/sprints/${sprintId}`, {
        method: 'PATCH',
        body: JSON.stringify({ capacityPoints: value !== '' ? parseInt(value) : null }),
      });
      toast.success('Sprint capacity updated.');
      fetchSprintsAndMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update capacity.');
    }
  };

  const fetchSprintsAndMembers = useCallback(async () => {
    if (!slug || !key) return;
    setIsLoading(true);
    try {
      const [sprintsData, membersData] = await Promise.all([
        apiFetch(`/workspaces/${slug}/projects/${key}/sprints`),
        apiFetch(`/workspaces/${slug}/projects/${key}/members`)
      ]);
      setSprints(sprintsData.sprints || []);
      
      const { useAuthStore } = await import('../../store/auth.js');
      const { useCurrentWorkspaceStore } = await import('../../store/currentWorkspace.js');
      const currentUser = useAuthStore.getState().user;
      const isAdmin = useCurrentWorkspaceStore.getState().isAdmin();
      
      const myMembership = (membersData.members || []).find((m: { userId: string; role: string }) => m.userId === currentUser?.userId);
      const isProjectAdmin = myMembership?.role === 'project_admin';
      
      setCanManageSprint(isAdmin || isProjectAdmin);
    } catch (err) {
      console.error('Failed to load sprints or members', err);
    } finally {
      setIsLoading(false);
    }
  }, [slug, key]);

  useEffect(() => {
    let isCancelled = false;
    const init = async () => {
      await Promise.resolve();
      if (!isCancelled) {
        fetchSprintsAndMembers();
      }
    };
    init();
    return () => {
      isCancelled = true;
    };
  }, [fetchSprintsAndMembers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    setIsCreating(true);
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/sprints`, {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          goal: newGoal || null,
          capacityPoints: newCapacityPoints !== '' ? parseInt(newCapacityPoints) : null,
          startDate: newStartDate || null,
          endDate: newEndDate || null,
        }),
      });
      setShowCreateModal(false);
      setNewName('');
      setNewGoal('');
      setNewCapacityPoints('');
      fetchSprintsAndMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create sprint.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStart = async () => {
    if (!showStartModal) return;
    setIsStarting(true);
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/sprints/${showStartModal.sprintId}/start`, {
        method: 'PATCH',
        body: JSON.stringify({
          startDate: startDate || new Date().toISOString(),
          endDate: startEndDate || null,
        }),
      });
      setShowStartModal(null);
      fetchSprintsAndMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start sprint.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleClose = async () => {
    if (!showCloseModal) return;
    setIsClosing(true);
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/sprints/${showCloseModal.sprintId}/close`, {
        method: 'PATCH',
      });
      setShowCloseModal(null);
      fetchSprintsAndMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close sprint.');
    } finally {
      setIsClosing(false);
    }
  };

  const handleDelete = async (sprintId: string) => {
    if (!(await confirm({ message: 'Delete this sprint? This action cannot be undone.', isDestructive: true }))) return;
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/sprints/${sprintId}`, { method: 'DELETE' });
      fetchSprintsAndMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete sprint.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeSprint = sprints.find(s => s.status === 'active');
  const futureSprints = sprints.filter(s => s.status === 'future');
  const closedSprints = sprints.filter(s => s.status === 'closed');

  return (
    <div className="h-full p-8 font-sans overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sprints</h2>
          <p className="text-muted-foreground text-sm">Manage iterations and view historical velocity.</p>
        </div>
        {canManageSprint && (
          <Button 
            onClick={() => {
              setNewName(`Sprint ${sprints.length + 1}`);
              setShowCreateModal(true);
            }}
            className="flex items-center px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold rounded-md transition-colors"
            variant="default" size="default"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Sprint
          </Button>
        )}
      </div>

      {/* Active Sprint */}
      {activeSprint && (
        <div className="mb-10 bg-primary-muted border border-primary-border rounded-lg p-6 shadow-sm relative overflow-hidden">

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="px-2.5 py-1 bg-success-muted border border-success-border text-success text-xs font-bold uppercase tracking-wider rounded-md">
                Active Sprint
              </div>
              <h3 className="text-xl font-bold text-foreground">{activeSprint.name}</h3>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate(`/w/${slug}/projects/${key}/sprints/active`)}
                className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary-hover transition-colors"
                variant="default" size="default"
              >
                View Board
              </Button>
              {canManageSprint && (
                <Button
                  onClick={() => setShowCloseModal(activeSprint)}
                  className="text-sm font-semibold bg-secondary text-foreground px-4 py-2 rounded-md hover:bg-hover transition-colors border border-border"
                  variant="secondary" size="default"
                >
                  Close Sprint
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center text-muted-foreground">
              <Target className="w-4 h-4 mr-2" />
              <span className="font-medium text-foreground">{activeSprint.goal || 'No sprint goal set'}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-subtle-foreground" />
              {activeSprint.startDate ? format(new Date(activeSprint.startDate), 'MMM d') : '-'} – {activeSprint.endDate ? format(new Date(activeSprint.endDate), 'MMM d, yyyy') : '-'}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="bg-secondary px-2 py-1 border border-border rounded">{activeSprint.stats?.taskCount ?? 0} tasks</span>
              <Badge variant="outline" className="bg-primary-muted text-primary border-primary-border h-auto py-1">
                {activeSprint.stats?.completedPoints ?? 0} / {activeSprint.stats?.totalPoints ?? 0} pts
              </Badge>
              {canManageSprint ? (
                <label className="flex items-center gap-1.5 bg-secondary px-2 py-1 border border-border rounded text-muted-foreground">
                  capacity
                  <Input
                    type="number"
                    min="0"
                    aria-label={`Capacity in points for sprint ${activeSprint.name}`}
                    value={capacityDrafts[activeSprint.sprintId] ?? activeSprint.capacityPoints ?? ''}
                    onChange={e => setCapacityDrafts(d => ({ ...d, [activeSprint.sprintId]: e.target.value }))}
                    onBlur={() => saveCapacity(activeSprint.sprintId)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-14 h-auto rounded-sm border-border px-1 py-0.5 text-xs font-mono md:text-xs"
                  />
                  pts
                </label>
              ) : activeSprint.capacityPoints != null ? (
                <span className="bg-secondary px-2 py-1 border border-border rounded text-muted-foreground">
                  capacity {activeSprint.capacityPoints} pts
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Future Sprints */}
      {futureSprints.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-bold text-foreground mb-4">Planned Sprints</h3>
          <div className="space-y-4">
            {futureSprints.map(sprint => (
              <div key={sprint.sprintId} className="flex items-center justify-between p-5 bg-card border border-border rounded-lg hover:bg-hover transition-colors">
                <div>
                  <div className="flex items-center space-x-3 mb-1.5">
                    <h4 className="text-base font-bold text-foreground">{sprint.name}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-primary-muted text-primary border border-primary-border">
                      future
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-subtle-foreground space-x-4">
                    {sprint.goal && <span>{sprint.goal}</span>}
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{sprint.stats?.taskCount ?? 0} tasks</span>
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-special">{sprint.stats?.totalPoints ?? 0} pts</span>
                    {canManageSprint ? (
                      <label className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded border border-border text-subtle-foreground">
                        cap
                        <Input
                          type="number"
                          min="0"
                          aria-label={`Capacity in points for sprint ${sprint.name}`}
                          value={capacityDrafts[sprint.sprintId] ?? sprint.capacityPoints ?? ''}
                          onChange={e => setCapacityDrafts(d => ({ ...d, [sprint.sprintId]: e.target.value }))}
                          onBlur={() => saveCapacity(sprint.sprintId)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className="w-12 h-auto rounded-sm border-border px-1 py-0 text-xs font-mono md:text-xs"
                        />
                      </label>
                    ) : sprint.capacityPoints != null ? (
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border">cap {sprint.capacityPoints}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {canManageSprint && (
                    <>
                      <Button 
                        onClick={() => {
                          setStartDate(new Date().toISOString().substring(0, 10));
                          setStartEndDate('');
                          setShowStartModal(sprint);
                        }}
                        className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary hover:bg-hover px-3 py-1.5 rounded transition-colors"
                        variant="secondary" size="default"
                      >
                        <Play className="w-4 h-4 mr-2 text-success" />
                        Start
                      </Button>
                      <Button
                        onClick={() => handleDelete(sprint.sprintId)}
                        className="p-1.5 text-subtle-foreground hover:text-danger hover:bg-hover rounded transition-colors"
                        size="icon" variant="destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Closed Sprints */}
      {closedSprints.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4">Completed Sprints</h3>
          <div className="space-y-4">
            {closedSprints.map(sprint => (
              <div key={sprint.sprintId} className="p-5 bg-card border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3 mb-1.5">
                      <h4 className="text-base font-bold text-foreground">{sprint.name}</h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-secondary text-subtle-foreground">
                        closed
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-subtle-foreground space-x-4">
                      <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5" /> 
                        {sprint.startDate ? format(new Date(sprint.startDate), 'MMM d') : 'N/A'} – {sprint.endDate ? format(new Date(sprint.endDate), 'MMM d') : 'N/A'}
                      </span>
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{sprint.stats?.taskCount ?? 0} tasks</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="bg-primary-muted text-primary border-primary-border px-1.5 font-mono">
                            {sprint.stats?.completedPoints ?? 0} pts done
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Velocity: story points completed</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-sm font-medium text-subtle-foreground">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Completed
                    </div>
                    <Button
                      onClick={() => navigate(`/w/${slug}/projects/${key}/sprints/${sprint.sprintId}`)}
                      className="text-xs font-semibold bg-secondary text-foreground px-3 py-1.5 rounded hover:bg-hover transition-colors border border-border"
                      variant="secondary" size="default"
                    >
                      View Details
                    </Button>
                  </div>
                </div>

                {sprint.aiSummary && (
                  <div className="mt-4 bg-special-muted border border-special-border rounded-lg p-4">
                    <div className="flex items-center text-xs text-special font-semibold uppercase tracking-wider mb-2">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI Sprint Summary
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{sprint.aiSummary.summary}</p>
                    {sprint.aiSummary.highlights && sprint.aiSummary.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {sprint.aiSummary.highlights.map((h, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start">
                            <span className="text-special mr-1.5">•</span>
                            {h}
                          </li>
                        ))}
                      </ul>
                    )}
                    {sprint.aiContributionReport && sprint.aiContributionReport.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-special-border space-y-1.5">
                        {sprint.aiContributionReport.map((c, idx) => (
                          <div key={idx} className="flex items-start text-xs">
                            <span className="text-foreground font-medium w-32 flex-shrink-0 truncate">{c.fullName}</span>
                            <span className="text-subtle-foreground flex-1">{c.summary}</span>
                            <span className="text-special flex-shrink-0 ml-2 font-mono">{c.tasksCompleted} done</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sprints.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-lg bg-card">
          <p className="text-subtle-foreground">No sprints created yet. Build your backlog and plan your first iteration.</p>
        </div>
      )}

      {/* CREATE SPRINT MODAL */}
      {showCreateModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowCreateModal(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Sprint</DialogTitle>
              <DialogDescription>Plan your next time-boxed iteration.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sprint-name">Sprint Name</Label>
                <Input id="sprint-name" type="text" value={newName} onChange={e => setNewName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprint-goal">Goal (optional)</Label>
                <Textarea id="sprint-goal" rows={2} value={newGoal} onChange={e => setNewGoal(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sprint-start">Start Date</Label>
                  <Input id="sprint-start" type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sprint-end">End Date</Label>
                  <Input id="sprint-end" type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprint-capacity">Capacity (story points, optional)</Label>
                <Input
                  id="sprint-capacity"
                  type="number"
                  min="0"
                  max="10000"
                  value={newCapacityPoints}
                  onChange={e => setNewCapacityPoints(e.target.value)}
                  placeholder="e.g. 40 — your team's estimated velocity"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* START SPRINT MODAL */}
      {showStartModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowStartModal(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Start Sprint: {showStartModal.name}</DialogTitle>
              <DialogDescription>Set the date range for this iteration.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input id="end-date" type="date" value={startEndDate} onChange={e => setStartEndDate(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowStartModal(null)}>Cancel</Button>
                <Button onClick={handleStart} disabled={isStarting}>
                  {isStarting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Start Sprint
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* CLOSE SPRINT MODAL */}
      {showCloseModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowCloseModal(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Close Sprint: {showCloseModal.name}</DialogTitle>
              <DialogDescription>
                Closing this sprint will mark it as completed. Any incomplete tasks will remain in the backlog.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseModal(null)}>Cancel</Button>
              <Button onClick={handleClose} disabled={isClosing}>
                {isClosing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Close Sprint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
