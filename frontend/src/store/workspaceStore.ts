import { create } from 'zustand';
import { apiFetch } from '../lib/api';

export interface Workspace {
  workspaceId: string;
  name: string;
  slug: string;
  createdAt: string;
  role: 'owner' | 'admin' | 'member';
  state?: 'active' | 'invited';
}

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (name: string, slug: string) => Promise<Workspace>;
  setCurrentWorkspace: (workspace: Workspace) => void;
  acceptInvite: (workspaceId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  isLoading: false,

  fetchWorkspaces: async () => {
    set({ isLoading: true });
    try {
      const data = await apiFetch('/workspaces');
      const workspaces = data.workspaces || [];
      
      set({ workspaces, isLoading: false });
      
      // Select the first one if there is no current workspace and workspaces exist
      if (workspaces.length > 0) {
        set((state) => {
          if (!state.currentWorkspace) {
            return { currentWorkspace: workspaces[0] };
          }
          return {};
        });
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
      set({ isLoading: false });
    }
  },

  createWorkspace: async (name, slug) => {
    const data = await apiFetch('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    set((state) => ({
      workspaces: [...state.workspaces, { ...data.workspace, role: 'owner' }],
      currentWorkspace: data.workspace,
    }));
    return data.workspace;
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });
  },

  acceptInvite: async (slug: string) => {
    await apiFetch(`/workspaces/${slug}/invites/accept`, { method: 'POST' });
    // Refetch workspaces after accepting
    await get().fetchWorkspaces();
  },
}));
