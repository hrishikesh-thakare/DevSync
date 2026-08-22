import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { WorkspaceSummary } from '@/types/api';

export type { WorkspaceSummary } from '@/types/api';

export interface CreateWorkspaceInput {
  name: string;
  /** Optional — the backend derives one from the name when omitted. */
  slug?: string;
  description?: string;
}

interface WorkspaceState {
  workspaces: WorkspaceSummary[];
  isLoading: boolean;
  error: string | null;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<WorkspaceSummary>;
  acceptInvite: (slug: string) => Promise<void>;
}

/**
 * The membership list behind the workspace picker.
 *
 * Deliberately separate from `useCurrentWorkspaceStore`, which holds the fully
 * hydrated workspace (members, projects, channels) for the shell. This one only
 * ever needs the summary rows from `GET /workspaces`.
 */
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  isLoading: true,
  error: null,

  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch('/workspaces');
      set({ workspaces: data.workspaces ?? [], isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Could not load your workspaces.',
        isLoading: false,
      });
    }
  },

  createWorkspace: async (input) => {
    // The schema is .strict(), so only send keys that were actually filled in.
    const body: CreateWorkspaceInput = { name: input.name };
    if (input.slug) body.slug = input.slug;
    if (input.description) body.description = input.description;

    const data = await apiFetch('/workspaces', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // POST returns the workspace row alone; the creator is always its owner, and
    // the membership fields the list view renders are not on that row.
    const created: WorkspaceSummary = {
      ...data.workspace,
      role: 'owner',
      state: 'active',
      joinedAt: data.workspace.createdAt,
    };

    set((state) => ({ workspaces: [...state.workspaces, created] }));
    return created;
  },

  acceptInvite: async (slug) => {
    await apiFetch(`/workspaces/${slug}/invites/accept`, { method: 'POST' });
    await get().fetchWorkspaces();
  },
}));
