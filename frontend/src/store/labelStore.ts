import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { useTaskStore } from '@/store/taskStore';
import type { ProjectLabel } from '@/types/api';

/**
 * Project labels.
 *
 * Note the data model: `project_labels` is a catalogue of names, while a task's
 * `labels` column is a plain JSON array of *strings*. No foreign key joins them,
 * and every comparison is case-insensitive (see the `usageCount` subquery in
 * labels.controller.ts). Renaming or deleting a label therefore has to touch two
 * places, and the server does both — it rewrites the matching strings inside
 * every task row in the same request. This store mirrors that second effect onto
 * whatever board is already in memory.
 */
interface LabelState {
  labels: ProjectLabel[];
  isLoading: boolean;
  error: string | null;

  fetchLabels: (slug: string, key: string) => Promise<void>;
  createLabel: (slug: string, key: string, name: string, color: string) => Promise<ProjectLabel>;
  updateLabel: (
    slug: string,
    key: string,
    labelId: string,
    patch: { name?: string; color?: string },
  ) => Promise<void>;
  deleteLabel: (slug: string, key: string, labelId: string) => Promise<void>;
  reset: () => void;
}

const base = (slug: string, key: string) => `/workspaces/${slug}/projects/${key}/labels`;

/**
 * Applies a label rename (or removal, when `to` is null) to the tasks already
 * loaded in `useTaskStore`, matching case-insensitively the way the server does.
 */
function renameOnLoadedTasks(from: string, to: string | null): void {
  const lower = from.toLowerCase();
  useTaskStore.setState((state) => ({
    tasks: state.tasks.map((task) => {
      const labels = task.labels ?? [];
      if (!labels.some((l) => l.toLowerCase() === lower)) return task;
      return {
        ...task,
        labels:
          to === null
            ? labels.filter((l) => l.toLowerCase() !== lower)
            : labels.map((l) => (l.toLowerCase() === lower ? to : l)),
      };
    }),
  }));
}

export const useLabelStore = create<LabelState>((set, get) => ({
  labels: [],
  isLoading: true,
  error: null,

  fetchLabels: async (slug, key) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch(base(slug, key));
      set({ labels: data.labels ?? [], isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Could not load labels.',
        isLoading: false,
      });
    }
  },

  createLabel: async (slug, key, name, color) => {
    // `createLabelSchema` is .strict() and validates colour as `#rrggbb`.
    const data = await apiFetch(base(slug, key), {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
    // The 201 payload has no `usageCount` — a brand-new label is on no tasks.
    // The name comes back normalised (trimmed, lower-cased), so use the
    // server's version rather than what was typed.
    const created: ProjectLabel = { ...data.label, usageCount: 0 };
    set((state) => ({
      labels: [...state.labels, created].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return created;
  },

  updateLabel: async (slug, key, labelId, patch) => {
    const previous = get().labels.find((l) => l.labelId === labelId)?.name;
    await apiFetch(`${base(slug, key)}/${labelId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    // A rename rewrites the name inside every task's `labels` array server-side
    // (and normalises case while doing it), so the catalogue is re-read rather
    // than patched in place…
    await get().fetchLabels(slug, key);
    // …and any board already in memory is brought along, since it holds those
    // same strings and would otherwise show the old name until a refetch.
    const renamed = get().labels.find((l) => l.labelId === labelId)?.name;
    if (previous && renamed && renamed !== previous) {
      renameOnLoadedTasks(previous, renamed);
    }
  },

  deleteLabel: async (slug, key, labelId) => {
    const removed = get().labels.find((l) => l.labelId === labelId)?.name;
    await apiFetch(`${base(slug, key)}/${labelId}`, { method: 'DELETE' });
    set((state) => ({ labels: state.labels.filter((l) => l.labelId !== labelId) }));
    // Deleting also strips the label off every task that carried it.
    if (removed) renameOnLoadedTasks(removed, null);
  },

  reset: () => set({ labels: [], isLoading: true, error: null }),
}));
