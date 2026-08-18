import { create } from 'zustand';
import { apiFetch } from '../lib/api.js';

export interface ProjectLabel {
  labelId: string;
  name: string;
  color: string;
  usageCount: number;
}

interface LabelState {
  labels: ProjectLabel[];
  colorByName: Record<string, string>;
  isLoading: boolean;
  fetchLabels: (slug: string, projectKey: string) => Promise<void>;
  createLabel: (slug: string, projectKey: string, name: string, color?: string) => Promise<ProjectLabel>;
  updateLabel: (slug: string, projectKey: string, labelId: string, patch: { name?: string; color?: string }) => Promise<void>;
  deleteLabel: (slug: string, projectKey: string, labelId: string) => Promise<void>;
}

export const useLabelStore = create<LabelState>((set) => ({
  labels: [],
  colorByName: {},
  isLoading: false,

  fetchLabels: async (slug, projectKey) => {
    set({ isLoading: true });
    try {
      const data = await apiFetch(`/workspaces/${slug}/projects/${projectKey}/labels`);
      const labels: ProjectLabel[] = data.labels || [];
      const colorByName: Record<string, string> = {};
      for (const l of labels) colorByName[l.name] = l.color;
      set({ labels, colorByName, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch labels', err);
      set({ isLoading: false });
    }
  },

  createLabel: async (slug, projectKey, name, color) => {
    const data = await apiFetch(`/workspaces/${slug}/projects/${projectKey}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
    const label = data.label as ProjectLabel;
    set((state) => ({
      labels: [...state.labels.filter(l => l.name !== label.name), label].sort((a, b) => a.name.localeCompare(b.name)),
      colorByName: { ...state.colorByName, [label.name]: label.color },
    }));
    return label;
  },

  updateLabel: async (slug, projectKey, labelId, patch) => {
    const data = await apiFetch(`/workspaces/${slug}/projects/${projectKey}/labels/${labelId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    const updated = data.label as ProjectLabel;
    set((state) => {
      const colorByName = { ...state.colorByName };
      if (patch.name && patch.name !== updated.name) delete colorByName[patch.name];
      colorByName[updated.name] = updated.color;
      return {
        labels: state.labels.map(l => (l.labelId === updated.labelId ? updated : l)),
        colorByName,
      };
    });
  },

  deleteLabel: async (slug, projectKey, labelId) => {
    await apiFetch(`/workspaces/${slug}/projects/${projectKey}/labels/${labelId}`, { method: 'DELETE' });
    set((state) => {
      const removed = state.labels.find(l => l.labelId === labelId);
      const colorByName = { ...state.colorByName };
      if (removed) delete colorByName[removed.name];
      return { labels: state.labels.filter(l => l.labelId !== labelId), colorByName };
    });
  },
}));