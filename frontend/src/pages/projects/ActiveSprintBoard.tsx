import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BoardPage } from './BoardPage.js';
import { Target, Calendar, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { useAuthStore } from '../../store/auth.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useBoardStore } from '../../store/boardStore.js';
import { Button } from '@/components/ui/button';

/**
 * A sprint as returned by `GET /workspaces/:slug/projects/:key/sprints`. Only the
 * fields this header renders are declared. `stats` and `aiSummary` are optional
 * because the worker writes them after a sprint closes.
 */
interface SprintDetail {
  sprintId: string;
  name: string;
  status: 'future' | 'active' | 'closed';
  goal?: string | null;
  endDate?: string | null;
  capacityPoints?: number | null;
  stats?: {
    totalPoints?: number;
    completedPoints?: number;
    taskCount?: number;
    completedCount?: number;
  };
  aiSummary?: {
    summary: string;
    highlights?: string[];
  } | null;
}

export const ActiveSprintBoard = () => {
  const { slug, key, sprintId } = useParams();
  const [activeSprint, setActiveSprint] = useState<SprintDetail | null>(null);

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
        let sprint: SprintDetail | undefined;
        if (sprintId) {
          sprint = data.sprints?.find((s: SprintDetail) => s.sprintId === sprintId);
        } else {
          sprint = data.sprints?.find((s: SprintDetail) => s.status === 'active');
        }
        setActiveSprint(sprint ?? null);
      } catch (err) {
        console.error("Couldn't load sprints. Check your connection and try again.", err);
      }
    };
    if (slug && key) fetchSprints();
  }, [slug, key, sprintId]);

  return (
    <div className="flex h-full flex-col font-sans">
      
      {/* Active Sprint Header */}
      {activeSprint && (
      <div className="bg-card border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between shrink-0">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h2 className="text-h2 font-[590] text-foreground">{activeSprint.name}</h2>
            <span className="bg-hover border border-border text-muted-foreground text-micro font-[590] uppercase px-2 py-0.5 rounded">
              {activeSprint.status === 'closed' ? 'Closed' : activeSprint.status === 'future' ? 'Planned' : 'Active'}
            </span>
          </div>
          <div className="flex items-center text-ui text-muted-foreground space-x-4">
            {activeSprint.goal && (
            <span className="flex items-center text-foreground">
              <Target className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
              Goal: {activeSprint.goal}
            </span>
            )}
            {activeSprint.endDate && (
            <span className="flex items-center">
              <Calendar className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
              {activeSprint.status === 'closed' ? 'Ended' : 'Ends'} {formatDistanceToNow(new Date(activeSprint.endDate), { addSuffix: true })}
            </span>
            )}
            {activeSprint.status === 'closed' && (
            <span className="flex items-center text-special font-mono text-caption">
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
              <div className="text-micro font-[510] text-subtle-foreground mb-1 uppercase">Sprint Progress</div>
              <div className="flex items-center space-x-3">
                {/* §8 Progress: 6px track on --bg-inset, --primary fill, and the
                    over-capacity case switches to --warning. It is a graphic, so
                    it needs role="progressbar" with the aria-value* triple — and
                    the numeric value also exists as text beside it. */}
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Sprint progress"
                  className="w-32 h-1.5 bg-muted rounded-full overflow-hidden"
                >
                  <div
                    className={clsx(
                      'h-full rounded-full transition-[width] duration-[--duration-base] ease-standard',
                      pct > 100 ? 'bg-warning' : 'bg-primary'
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-ui font-mono text-foreground tabular-nums">{pct}%</span>
              </div>
              <div className="text-caption text-subtle-foreground mt-1 font-mono">
                {hasPoints ? `${completedPoints} / ${totalPoints} pts` : `${completedCount} / ${taskCount} tasks`}
                {activeSprint.capacityPoints != null && hasPoints && ` · capacity ${activeSprint.capacityPoints}`}
              </div>
            </div>
            {canManageSprint && (
              <Button className="px-4 py-2 bg-hover hover:bg-hover text-foreground text-ui font-[510] rounded-lg transition-colors border border-border" variant="secondary" size="default">
                Complete Sprint
              </Button>
            )}
          </div>
          );
        })()}
      </div>
      )}

      {/* AI Summary for closed sprints */}
      {activeSprint?.status === 'closed' && activeSprint.aiSummary && (
        <div className="bg-special-muted border-b border-special-border px-6 py-4 shrink-0">
          <div className="flex items-center text-caption text-special font-[590] uppercase mb-1.5">
            <Sparkles className="w-4 h-4 mr-1.5" strokeWidth={1.75} /> AI Sprint Summary
          </div>
          <p className="text-ui text-foreground leading-relaxed">{activeSprint.aiSummary.summary}</p>
          {activeSprint.aiSummary.highlights && activeSprint.aiSummary.highlights.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {activeSprint.aiSummary.highlights.map((h: string, idx: number) => (
                <li key={idx} className="text-caption text-muted-foreground flex items-start">
                  <span className="text-special mr-1.5">•</span>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* The actual Kanban Board component reused inside this container */}
      <div className="flex-1 overflow-x-auto relative bg-background">
        <BoardPage sprintId={activeSprint?.sprintId} />
      </div>
    </div>
  );
};
