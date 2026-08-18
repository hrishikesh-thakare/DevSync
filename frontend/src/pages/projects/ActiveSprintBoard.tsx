import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BoardPage } from './BoardPage.js';
import { Target, Calendar, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { useAuthStore } from '../../store/auth.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useBoardStore } from '../../store/boardStore.js';

export const ActiveSprintBoard = () => {
  const { slug, key, sprintId } = useParams();
  const [activeSprint, setActiveSprint] = useState<any>(null);

  const currentUser = useAuthStore(state => state.user);
  const { isAdmin } = useCurrentWorkspaceStore();
  const { members } = useBoardStore();

  const myMembership = members.find(m => m.userId === currentUser?.userId);
  const isProjectAdmin = myMembership?.role === 'project_admin';
  const canManageSprint = isAdmin() || isProjectAdmin;

  useEffect(() => {
    const fetchSprints = async () => {
      try {
        const { apiFetch } = await import('../../lib/api.js');
        const data = await apiFetch(`/workspaces/${slug}/projects/${key}/sprints`);
        let sprint;
        if (sprintId) {
          sprint = data.sprints?.find((s: any) => s.sprintId === sprintId);
        } else {
          sprint = data.sprints?.find((s: any) => s.status === 'active');
        }
        setActiveSprint(sprint);
      } catch (err) {
        console.error('Failed to fetch sprints', err);
      }
    };
    if (slug && key) fetchSprints();
  }, [slug, key, sprintId]);

  return (
    <div className="flex h-full flex-col font-sans">
      
      {/* Active Sprint Header */}
      {activeSprint && (
      <div className="bg-gray-900/80 border-b border-gray-800/60 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between shrink-0">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h2 className="text-xl font-bold text-white">{activeSprint.name}</h2>
            <span className="bg-white/10 border border-white/20 text-gray-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
              {activeSprint.status === 'closed' ? 'Closed' : activeSprint.status === 'future' ? 'Planned' : 'Active'}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-400 space-x-4">
            {activeSprint.goal && (
            <span className="flex items-center text-gray-300">
              <Target className="w-4 h-4 mr-1.5" />
              Goal: {activeSprint.goal}
            </span>
            )}
            {activeSprint.endDate && (
            <span className="flex items-center">
              <Calendar className="w-4 h-4 mr-1.5" />
              {activeSprint.status === 'closed' ? 'Ended' : 'Ends'} {formatDistanceToNow(new Date(activeSprint.endDate), { addSuffix: true })}
            </span>
            )}
            {activeSprint.status === 'closed' && (
            <span className="flex items-center text-purple-400 font-mono text-xs">
              {activeSprint.stats?.completedPoints ?? 0} pts completed
            </span>
            )}
          </div>
        </div>

        {activeSprint.status !== 'closed' && (() => {
          const totalPoints = activeSprint.stats?.totalPoints ?? 0;
          const completedPoints = activeSprint.stats?.completedPoints ?? 0;
          const taskCount = activeSprint.stats?.taskCount ?? 0;
          const completedCount = activeSprint.stats?.completedCount ?? 0;
          const hasPoints = totalPoints > 0;
          const pct = hasPoints
            ? Math.round((completedPoints / totalPoints) * 100)
            : taskCount > 0
              ? Math.round((completedCount / taskCount) * 100)
              : 0;
          return (
          <div className="mt-4 sm:mt-0 flex items-center space-x-6">
            <div className="flex flex-col items-end">
              <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Sprint Progress</div>
              <div className="flex items-center space-x-3">
                <div className="w-32 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                </div>
                <span className="text-sm font-mono text-gray-300">{pct}%</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 font-mono">
                {hasPoints ? `${completedPoints} / ${totalPoints} pts` : `${completedCount} / ${taskCount} tasks`}
                {activeSprint.capacityPoints != null && hasPoints && ` · capacity ${activeSprint.capacityPoints}`}
              </div>
            </div>
            {canManageSprint && (
              <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors border border-gray-700">
                Complete Sprint
              </button>
            )}
          </div>
          );
        })()}
      </div>
      )}

      {/* AI Summary for closed sprints */}
      {activeSprint?.status === 'closed' && activeSprint.aiSummary && (
        <div className="bg-gradient-to-br from-purple-900/20 to-gray-900/40 border-b border-purple-500/20 px-6 py-4 shrink-0">
          <div className="flex items-center text-xs text-purple-400 font-semibold uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI Sprint Summary
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">{activeSprint.aiSummary.summary}</p>
          {activeSprint.aiSummary.highlights && activeSprint.aiSummary.highlights.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {activeSprint.aiSummary.highlights.map((h: string, idx: number) => (
                <li key={idx} className="text-xs text-gray-400 flex items-start">
                  <span className="text-purple-400 mr-1.5">•</span>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* The actual Kanban Board component reused inside this container */}
      <div className="flex-1 overflow-x-auto relative bg-gray-950">
        <BoardPage sprintId={activeSprint?.sprintId} />
      </div>
    </div>
  );
};
