import { create } from 'zustand';
import { generateKeyBetween } from 'fractional-indexing';
import { apiFetch } from '@/lib/api';
import type { CreateTaskInput, TaskStatus, TaskSummary } from '@/types/api';

export type { TaskSummary, CreateTaskInput } from '@/types/api';

interface TaskState {
  tasks: TaskSummary[];
  isLoading: boolean;
  error: string | null;

  fetchTasks: (slug: string, key: string) => Promise<void>;
  createTask: (slug: string, key: string, input: CreateTaskInput) => Promise<TaskSummary>;
  /** Optimistic drag commit: moves the card locally, then persists the new rank. */
  moveTask: (
    slug: string,
    key: string,
    taskId: string,
    status: TaskStatus,
    afterTaskId: string | null,
    beforeTaskId: string | null,
  ) => Promise<void>;
  applyTaskUpdate: (update: Partial<TaskSummary> & { taskId: string }) => void;
  reset: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: true,
  error: null,

  fetchTasks: async (slug, key) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks`);
      set({ tasks: data.tasks ?? [], isLoading: false });
    } catch (err) {
      set({
        tasks: [],
        error: err instanceof Error ? err.message : 'Could not load tasks.',
        isLoading: false,
      });
    }
  },

  createTask: async (slug, key, input) => {
    const data = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    // POST returns the full task row; the board only needs the summary shape,
    // and the fields the list endpoint joins in are not on that row.
    const created: TaskSummary = {
      ...data.task,
      assigneeName: null,
      assigneeAvatar: null,
      linkedCommitsCount: 0,
      labels: data.task.labels ?? [],
    };

    set((state) => ({ tasks: [...state.tasks, created] }));
    return created;
  },

  moveTask: async (slug, key, taskId, status, afterTaskId, beforeTaskId) => {
    const previous = get().tasks;

    // Move optimistically so the card lands where it was dropped. Patching
    // `status` alone is not enough: the card would keep its old rank, sort to
    // wherever that stale value falls among its new column's siblings (visibly
    // the wrong slot), then jump again once the PATCH returns the real rank.
    // Two snaps per drag, which reads as lag even when the request is fast.
    //
    // So compute the same rank the server will, from the same neighbours the
    // caller already resolved, with the same library the backend uses. This
    // can only diverge if another client's move races it, and the success path
    // below adopts the server's authoritative rank regardless.
    let optimisticRank: string | undefined;
    if (afterTaskId || beforeTaskId) {
      const byId = new Map(previous.map((t) => [t.taskId, t]));
      const afterRank = afterTaskId ? (byId.get(afterTaskId)?.rank ?? null) : null;
      const beforeRank = beforeTaskId ? (byId.get(beforeTaskId)?.rank ?? null) : null;
      try {
        optimisticRank = generateKeyBetween(afterRank, beforeRank);
      } catch {
        // Tied neighbours. The server resolves this by appending after the
        // tied run rather than erroring, so mirror that here.
        try {
          optimisticRank = generateKeyBetween(afterRank, null);
        } catch {
          // Nothing sensible to guess — let the response settle it.
        }
      }
    } else {
      // Dropped with no neighbours at all, i.e. the only card in an empty
      // column — any key works since there is nothing to sort against.
      optimisticRank = generateKeyBetween(null, null);
    }

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === taskId ? { ...t, status, ...(optimisticRank ? { rank: optimisticRank } : {}) } : t,
      ),
    }));

    try {
      const data = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskId}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ status, afterTaskId, beforeTaskId }),
      });

      // Adopt the server's fractional index, otherwise the next drag computes
      // neighbours from a stale rank and positions drift over a session.
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.taskId === taskId ? { ...t, rank: data.task.rank, status: data.task.status } : t,
        ),
      }));
    } catch (err) {
      // Self-healing revert: restoring `tasks` here is what lets BoardPage skip
      // any revert logic of its own — its `filtered` memo and columns-sync
      // effect pick this up automatically.
      set({ tasks: previous });
      throw err;
    }
  },

  applyTaskUpdate: (update) => {
    set((state) => {
      const exists = state.tasks.some(t => t.taskId === update.taskId);
      if (!exists) return state; // Only update if we already have it in the board
      return {
        tasks: state.tasks.map((t) =>
          t.taskId === update.taskId ? { ...t, ...update } : t,
        ),
      };
    });
  },

  reset: () => set({ tasks: [], isLoading: true, error: null }),
}));

/** Board ordering: tasks arrive ranked, and `rank` is a plain lexicographic key. */
export function byRank(a: TaskSummary, b: TaskSummary) {
  return (a.rank ?? '').localeCompare(b.rank ?? '');
}
