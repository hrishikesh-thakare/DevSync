import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { Play, CheckCircle2, Calendar, Target, Loader2, Plus, X, Trash2, Sparkles } from 'lucide-react';

import { format } from 'date-fns';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';

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
    } catch (err: any) {
      toast.error(err.message || 'Failed to update capacity.');
    }
  };

  const fetchSprintsAndMembers = async () => {
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
      
      const myMembership = (membersData.members || []).find((m: any) => m.userId === currentUser?.userId);
      const isProjectAdmin = myMembership?.role === 'project_admin';
      
      setCanManageSprint(isAdmin || isProjectAdmin);
    } catch (err) {
      console.error('Failed to load sprints or members', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (slug && key) fetchSprintsAndMembers();
  }, [slug, key]);

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
    } catch (err: any) {
      toast.error(err.message || 'Failed to create sprint.');
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to start sprint.');
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to close sprint.');
    } finally {
      setIsClosing(false);
    }
  };

  const handleDelete = async (sprintId: string) => {
    if (!(await confirm({ message: 'Delete this sprint? This action cannot be undone.', isDestructive: true }))) return;
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/sprints/${sprintId}`, { method: 'DELETE' });
      fetchSprintsAndMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete sprint.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  const activeSprint = sprints.find(s => s.status === 'active');
  const futureSprints = sprints.filter(s => s.status === 'future');
  const closedSprints = sprints.filter(s => s.status === 'closed');

  return (
    <div className="h-full p-8 font-sans overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Sprints</h2>
          <p className="text-gray-400 text-sm">Manage iterations and view historical velocity.</p>
        </div>
        {canManageSprint && (
          <button 
            onClick={() => {
              setNewName(`Sprint ${sprints.length + 1}`);
              setShowCreateModal(true);
            }}
            className="flex items-center px-4 py-2 bg-white hover:bg-gray-200 text-gray-950 text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Sprint
          </button>
        )}
      </div>

      {/* Active Sprint */}
      {activeSprint && (
        <div className="mb-10 bg-gradient-to-r from-gray-700/40 to-gray-700/20 border border-white/30 rounded-2xl p-6 shadow-lg shadow-white/5 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-[40px] pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider rounded-md">
                Active Sprint
              </div>
              <h3 className="text-xl font-bold text-white">{activeSprint.name}</h3>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => navigate(`/w/${slug}/projects/${key}/sprints/active`)}
                className="text-sm font-semibold bg-white text-gray-950 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                View Board
              </button>
              {canManageSprint && (
                <button 
                  onClick={() => setShowCloseModal(activeSprint)}
                  className="text-sm font-semibold bg-gray-800 text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700"
                >
                  Close Sprint
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-6 text-sm text-gray-300">
            <div className="flex items-center text-gray-300">
              <Target className="w-4 h-4 mr-2" />
              <span className="font-medium text-gray-200">{activeSprint.goal || 'No sprint goal set'}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-gray-500" />
              {activeSprint.startDate ? format(new Date(activeSprint.startDate), 'MMM d') : '-'} – {activeSprint.endDate ? format(new Date(activeSprint.endDate), 'MMM d, yyyy') : '-'}
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="bg-gray-900 px-2 py-1 border border-gray-800 rounded">{activeSprint.stats?.taskCount ?? 0} tasks</span>
              <span className="bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2 py-1 rounded">
                {activeSprint.stats?.completedPoints ?? 0} / {activeSprint.stats?.totalPoints ?? 0} pts
              </span>
              {canManageSprint ? (
                <label className="flex items-center gap-1.5 bg-gray-900 px-2 py-1 border border-gray-800 rounded text-gray-400">
                  capacity
                  <input
                    type="number"
                    min="0"
                    value={capacityDrafts[activeSprint.sprintId] ?? activeSprint.capacityPoints ?? ''}
                    onChange={e => setCapacityDrafts(d => ({ ...d, [activeSprint.sprintId]: e.target.value }))}
                    onBlur={() => saveCapacity(activeSprint.sprintId)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-14 bg-transparent border border-gray-700 rounded px-1 py-0.5 text-gray-300 focus:outline-none focus:border-white"
                  />
                  pts
                </label>
              ) : activeSprint.capacityPoints != null ? (
                <span className="bg-gray-900 px-2 py-1 border border-gray-800 rounded text-gray-400">
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
          <h3 className="text-lg font-bold text-gray-200 mb-4">Planned Sprints</h3>
          <div className="space-y-4">
            {futureSprints.map(sprint => (
              <div key={sprint.sprintId} className="flex items-center justify-between p-5 bg-gray-900/50 border border-gray-800/60 rounded-xl hover:bg-gray-800/40 transition-colors">
                <div>
                  <div className="flex items-center space-x-3 mb-1.5">
                    <h4 className="text-base font-bold text-gray-200">{sprint.name}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-white/10 text-gray-300 border border-white/20">
                      future
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-gray-500 space-x-4">
                    {sprint.goal && <span>{sprint.goal}</span>}
                    <span className="font-mono bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">{sprint.stats?.taskCount ?? 0} tasks</span>
                    <span className="font-mono bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800 text-purple-400/80">{sprint.stats?.totalPoints ?? 0} pts</span>
                    {canManageSprint ? (
                      <label className="flex items-center gap-1 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800 text-gray-500">
                        cap
                        <input
                          type="number"
                          min="0"
                          value={capacityDrafts[sprint.sprintId] ?? sprint.capacityPoints ?? ''}
                          onChange={e => setCapacityDrafts(d => ({ ...d, [sprint.sprintId]: e.target.value }))}
                          onBlur={() => saveCapacity(sprint.sprintId)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className="w-12 bg-transparent border border-gray-700 rounded px-1 py-0 text-gray-300 focus:outline-none focus:border-white"
                        />
                      </label>
                    ) : sprint.capacityPoints != null ? (
                      <span className="font-mono bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">cap {sprint.capacityPoints}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {canManageSprint && (
                    <>
                      <button 
                        onClick={() => {
                          setStartDate(new Date().toISOString().substring(0, 10));
                          setStartEndDate('');
                          setShowStartModal(sprint);
                        }}
                        className="flex items-center text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded transition-colors"
                      >
                        <Play className="w-4 h-4 mr-2 text-emerald-400" />
                        Start
                      </button>
                      <button 
                        onClick={() => handleDelete(sprint.sprintId)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
          <h3 className="text-lg font-bold text-gray-200 mb-4">Completed Sprints</h3>
          <div className="space-y-4">
            {closedSprints.map(sprint => (
              <div key={sprint.sprintId} className="p-5 bg-gray-900/50 border border-gray-800/60 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3 mb-1.5">
                      <h4 className="text-base font-bold text-gray-200">{sprint.name}</h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-gray-800 text-gray-500">
                        closed
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5" /> 
                        {sprint.startDate ? format(new Date(sprint.startDate), 'MMM d') : 'N/A'} – {sprint.endDate ? format(new Date(sprint.endDate), 'MMM d') : 'N/A'}
                      </span>
                      <span className="font-mono bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">{sprint.stats?.taskCount ?? 0} tasks</span>
                      <span className="font-mono bg-purple-500/10 border border-purple-500/30 text-purple-400 px-1.5 py-0.5 rounded" title="Velocity: story points completed">
                        {sprint.stats?.completedPoints ?? 0} pts done
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center text-sm font-medium text-gray-500">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Completed
                    </div>
                    <button 
                      onClick={() => navigate(`/w/${slug}/projects/${key}/sprints/${sprint.sprintId}`)}
                      className="text-xs font-semibold bg-gray-800 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors border border-gray-700"
                    >
                      View Details
                    </button>
                  </div>
                </div>

                {sprint.aiSummary && (
                  <div className="mt-4 bg-gradient-to-br from-purple-900/20 to-gray-900/40 border border-purple-500/20 rounded-lg p-4">
                    <div className="flex items-center text-xs text-purple-400 font-semibold uppercase tracking-wider mb-2">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI Sprint Summary
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{sprint.aiSummary.summary}</p>
                    {sprint.aiSummary.highlights && sprint.aiSummary.highlights.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {sprint.aiSummary.highlights.map((h, idx) => (
                          <li key={idx} className="text-xs text-gray-400 flex items-start">
                            <span className="text-purple-400 mr-1.5">•</span>
                            {h}
                          </li>
                        ))}
                      </ul>
                    )}
                    {sprint.aiContributionReport && sprint.aiContributionReport.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-purple-500/10 space-y-1.5">
                        {sprint.aiContributionReport.map((c, idx) => (
                          <div key={idx} className="flex items-start text-xs">
                            <span className="text-gray-300 font-medium w-32 flex-shrink-0 truncate">{c.fullName}</span>
                            <span className="text-gray-500 flex-1">{c.summary}</span>
                            <span className="text-purple-400 flex-shrink-0 ml-2 font-mono">{c.tasksCompleted} done</span>
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
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl bg-gray-900/30">
          <p className="text-gray-500">No sprints created yet. Build your backlog and plan your first iteration.</p>
        </div>
      )}

      {/* CREATE SPRINT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Create Sprint</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Sprint Name</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Goal (optional)</label>
                <textarea rows={2} value={newGoal} onChange={e => setNewGoal(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
                  <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                  <input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Capacity (story points, optional)</label>
                <input type="number" min="0" max="10000" value={newCapacityPoints} onChange={e => setNewCapacityPoints(e.target.value)}
                  placeholder="e.g. 40 — your team's estimated velocity"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white" />
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-400 hover:text-white font-medium">Cancel</button>
                <button type="submit" disabled={isCreating} className="px-6 py-2 bg-white text-gray-950 hover:bg-gray-200 font-bold rounded-lg disabled:opacity-50 flex items-center">
                  {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* START SPRINT MODAL */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Start Sprint: {showStartModal.name}</h3>
              <button onClick={() => setShowStartModal(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                  <input type="date" value={startEndDate} onChange={e => setStartEndDate(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white" />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button onClick={() => setShowStartModal(null)} className="px-4 py-2 text-gray-400 hover:text-white font-medium">Cancel</button>
                <button onClick={handleStart} disabled={isStarting} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg disabled:opacity-50 flex items-center">
                  {isStarting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Start Sprint
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE SPRINT MODAL */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Close Sprint: {showCloseModal.name}</h3>
              <button onClick={() => setShowCloseModal(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-300 text-sm">
                Closing this sprint will mark it as completed. Any incomplete tasks will remain in the backlog.
              </p>
              <div className="pt-4 flex justify-end space-x-3">
                <button onClick={() => setShowCloseModal(null)} className="px-4 py-2 text-gray-400 hover:text-white font-medium">Cancel</button>
                <button onClick={handleClose} disabled={isClosing} className="px-6 py-2 bg-white text-gray-950 hover:bg-gray-200 font-bold rounded-lg disabled:opacity-50 flex items-center">
                  {isClosing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Close Sprint
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
