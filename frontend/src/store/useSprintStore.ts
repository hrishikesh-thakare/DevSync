import { create } from 'zustand';
import { apiFetch } from '../lib/api';
import { useWorkspaceStore } from './workspaceStore';
import { useProjectStore } from './useProjectStore';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: 'future' | 'active' | 'closed';
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

interface SprintState {
  sprints: Sprint[];
  activeSprint: Sprint | null;
  isLoading: boolean;
  fetchSprints: () => Promise<void>;
  createSprint: (name: string, goal?: string, startDate?: string, endDate?: string) => Promise<void>;
  updateSprintStatus: (sprintId: string, status: 'future' | 'active' | 'closed') => Promise<void>;
}

export const useSprintStore = create<SprintState>((set, get) => ({
  sprints: [],
  activeSprint: null,
  isLoading: false,

  fetchSprints: async () => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    const project = useProjectStore.getState().activeProject;
    
    if (!workspace || !project) return;

    set({ isLoading: true });
    try {
      interface RawSprint {
        sprintId: string;
        projectId: string;
        name: string;
        goal?: string | null;
        status: string;
        startDate: string;
        endDate: string;
        createdAt: string;
      }
      const data = await apiFetch(`/workspaces/${workspace.slug}/projects/${project.id}/sprints`);
      const mappedSprints: Sprint[] = data.sprints.map((s: RawSprint) => ({
        id: s.sprintId,
        projectId: s.projectId,
        name: s.name,
        goal: s.goal,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        createdAt: s.createdAt
      }));

      const activeSprint = mappedSprints.find(s => s.status === 'active') || null;

      set({ sprints: mappedSprints, activeSprint, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch sprints:', err);
      set({ isLoading: false });
    }
  },

  createSprint: async (name, goal, startDate, endDate) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    const project = useProjectStore.getState().activeProject;
    
    if (!workspace || !project) return;

    try {
      await apiFetch(`/workspaces/${workspace.slug}/projects/${project.id}/sprints`, {
        method: 'POST',
        body: JSON.stringify({ name, goal, startDate, endDate }),
      });
      get().fetchSprints();
    } catch (err) {
      console.error('Failed to create sprint:', err);
    }
  },

  updateSprintStatus: async (sprintId, status) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    const project = useProjectStore.getState().activeProject;
    
    if (!workspace || !project) return;

    try {
      await apiFetch(`/workspaces/${workspace.slug}/projects/${project.id}/sprints/${sprintId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      get().fetchSprints();
    } catch (err) {
      console.error('Failed to update sprint status:', err);
    }
  }
}));
