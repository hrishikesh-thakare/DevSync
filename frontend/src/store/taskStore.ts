import { create } from 'zustand';
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

    // Move optimistically so the card lands where it was dropped. The rank the
    // server computes is authoritative, so the list is refetched on failure.
    set((state) => ({
      tasks: state.tasks.map((t) => (t.taskId === taskId ? { ...t, status } : t)),
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

  reset: () => set({ tasks: [], isLoading: true, error: null }),
}));

/** Board ordering: tasks arrive ranked, and `rank` is a plain lexicographic key. */
export function byRank(a: TaskSummary, b: TaskSummary) {
  return (a.rank ?? '').localeCompare(b.rank ?? '');
}
