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

    // Move optimistically so the card lands where it was dropped. Previously
    // this patched `status` only, leaving `rank` untouched — the card kept its
    // old rank, got sorted to wherever that stale value fell among its new
    // column's siblings (visibly the wrong slot), then jumped again once the
    // PATCH round-trip returned the real rank. Two snaps per drag, which reads
    // as lag even when the request itself is fast.
    //
    // The fix: compute the same rank the server will, from the same neighbours
    // the caller already resolved, using the identical library the backend
    // uses (`tasks.controller.ts`'s reorder handler). This can only diverge
    // from the server's actual value if another client's move races it between
    // this computation and the request landing — rare, and `onSuccess` below
    // still adopts the server's authoritative rank when the response returns.
    let optimisticRank: string | undefined;
    if (afterTaskId || beforeTaskId) {
      const byId = new Map(previous.map((t) => [t.taskId, t]));
      const afterRank = afterTaskId ? (byId.get(afterTaskId)?.rank ?? null) : null;
      const beforeRank = beforeTaskId ? (byId.get(beforeTaskId)?.rank ?? null) : null;
      try {
        optimisticRank = generateKeyBetween(afterRank, beforeRank);
      } catch {
        // Equal or malformed neighbour ranks — generateKeyBetween throws
        // rather than guess. Falling through leaves the old rank in place;
        // the card still moves columns, just re-settles on the server's
        // response instead of immediately, exactly like before this fix.
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
      // neighbours from a stale rank and positions drift.
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.taskId === taskId ? { ...t, rank: data.task.rank, status: data.task.status } : t,
        ),
      }));
    } catch (err) {
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
