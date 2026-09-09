import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { Sprint } from '@/types/api';

export type { Sprint } from '@/types/api';

export interface SprintInput {
  name: string;
  goal?: string | null;
  capacityPoints?: number | null;
  /** ISO datetime strings — the schema uses `z.string().datetime()`. */
  startDate?: string | null;
  endDate?: string | null;
}

interface SprintState {
  sprints: Sprint[];
  isLoading: boolean;
  error: string | null;

  fetchSprints: (slug: string, key: string) => Promise<void>;
  createSprint: (slug: string, key: string, input: SprintInput) => Promise<Sprint>;
  updateSprint: (slug: string, key: string, sprintId: string, input: SprintInput) => Promise<void>;
  startSprint: (slug: string, key: string, sprintId: string, dates?: { startDate?: string; endDate?: string }) => Promise<void>;
  closeSprint: (slug: string, key: string, sprintId: string) => Promise<{ totalTasks: number; completed: number; incomplete: number }>;
  deleteSprint: (slug: string, key: string, sprintId: string) => Promise<void>;
  addTask: (slug: string, key: string, sprintId: string, taskId: string) => Promise<void>;
  removeTask: (slug: string, key: string, sprintId: string, taskId: string) => Promise<void>;
  reset: () => void;
}

const base = (slug: string, key: string) => `/workspaces/${slug}/projects/${key}/sprints`;

export const useSprintStore = create<SprintState>((set, get) => ({
  sprints: [],
  isLoading: true,
  error: null,

  fetchSprints: async (slug, key) => {
    set({ isLoading: true, error: null });
    try {
      // Each row carries a server-computed `stats` rollup — the only real
      // aggregation the API offers, and what the progress bars are built from.
      const data = await apiFetch(base(slug, key));
      set({ sprints: data.sprints ?? [], isLoading: false });
    } catch (err) {
      set({
        sprints: [],
        error: err instanceof Error ? err.message : 'Could not load sprints.',
        isLoading: false,
      });
    }
  },

  createSprint: async (slug, key, input) => {
    const data = await apiFetch(base(slug, key), {
      method: 'POST',
      body: JSON.stringify(input),
    });
    set((state) => ({ sprints: [...state.sprints, data.sprint] }));
    return data.sprint as Sprint;
  },

  updateSprint: async (slug, key, sprintId, input) => {
    const data = await apiFetch(`${base(slug, key)}/${sprintId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    set((state) => ({
      sprints: state.sprints.map((s) =>
        s.sprintId === sprintId ? { ...s, ...data.sprint, stats: s.stats } : s,
      ),
    }));
  },

  startSprint: async (slug, key, sprintId, dates) => {
    await apiFetch(`${base(slug, key)}/${sprintId}/start`, {
      method: 'PATCH',
      body: JSON.stringify(dates ?? {}),
    });
    // Starting affects which sprint is active, so refetch rather than patch.
    await get().fetchSprints(slug, key);
  },

  closeSprint: async (slug, key, sprintId) => {
    const data = await apiFetch(`${base(slug, key)}/${sprintId}/close`, { method: 'PATCH' });
    await get().fetchSprints(slug, key);
    return data.stats;
  },

  deleteSprint: async (slug, key, sprintId) => {
    await apiFetch(`${base(slug, key)}/${sprintId}`, { method: 'DELETE' });
    set((state) => ({ sprints: state.sprints.filter((s) => s.sprintId !== sprintId) }));
  },

  addTask: async (slug, key, sprintId, taskId) => {
    await apiFetch(`${base(slug, key)}/${sprintId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  },

  removeTask: async (slug, key, sprintId, taskId) => {
    await apiFetch(`${base(slug, key)}/${sprintId}/tasks/${taskId}`, { method: 'DELETE' });
  },

  reset: () => set({ sprints: [], isLoading: true, error: null }),
}));
