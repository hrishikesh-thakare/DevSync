import { create } from 'zustand';
import { apiFetch } from '../lib/api.js';

interface Project {
  projectId: string;
  name: string;
  key: string;
}

interface Channel {
  channelId: string;
  name: string;
  type: string;
  projectId?: string | null;
  isAnnouncementOnly?: boolean;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type ProjectRole = 'project_admin' | 'developer' | 'viewer';

/**
 * A row from `GET /workspaces/:slug`'s members list. `presence`, `statusText`
 * and `statusEmoji` are optional because they arrive later, over the socket,
 * via `updateMemberPresence` rather than in the initial payload.
 */
export interface WorkspaceMember {
  userId: string;
  fullName: string;
  email: string;
  role: WorkspaceRole;
  displayName?: string | null;
  avatarUrl?: string | null;
  state?: string;
  joinedAt?: string;
  presence?: string;
  statusText?: string | null;
  statusEmoji?: string | null;
}

interface CurrentWorkspaceState {
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  myRole: WorkspaceRole;
  memberCount: number;
  members: WorkspaceMember[];
  projects: Project[];
  channels: Channel[];
  isLoading: boolean;
  error: string | null;
  // Helpers
  isAdmin: () => boolean;
  isOwner: () => boolean;
  // Actions
  fetchWorkspaceData: (slug: string) => Promise<void>;
  createChannel: (slug: string, name: string, isPrivate: boolean) => Promise<void>;
  createProject: (slug: string, name: string, key: string, description?: string) => Promise<void>;
  updateMemberPresence: (userId: string, data: { presence?: string, statusText?: string, statusEmoji?: string }) => void;
}

export const useCurrentWorkspaceStore = create<CurrentWorkspaceState>((set, get) => ({
  workspaceId: '',
  name: '',
  slug: '',
  description: '',
  myRole: 'member',
  memberCount: 0,
  members: [],
  projects: [],
  channels: [],
  isLoading: true,
  error: null,

  isAdmin: () => {
    const role = get().myRole;
    return role === 'owner' || role === 'admin';
  },

  isOwner: () => get().myRole === 'owner',

  fetchWorkspaceData: async (slug: string) => {
    set({ isLoading: true, error: null });
    try {
      // The backend /api/workspaces/:slug endpoint returns workspace + members
      const data = await apiFetch(`/workspaces/${slug}`);

      // Determine current user's role from the members list
      const { useAuthStore } = await import('./auth.js');
      const currentUserId = useAuthStore.getState().user?.userId;
      const myMembership = (data.members || []).find(
        (m: WorkspaceMember) => m.userId === currentUserId
      );

      // Also fetch projects and channels for sidebar
      const [projectsData, channelsData] = await Promise.all([
        apiFetch(`/workspaces/${slug}/projects`),
        apiFetch(`/workspaces/${slug}/channels`),
      ]);

      set({
        workspaceId: data.workspace.workspaceId,
        name: data.workspace.name,
        slug: data.workspace.slug,
        description: data.workspace.description || '',
        myRole: myMembership?.role || 'member',
        memberCount: (data.members || []).length,
        members: data.members || [],
        projects: projectsData.projects || [],
        channels: channelsData.channels || [],
        isLoading: false,
      });
    } catch (err: unknown) {
      console.error('Failed to load workspace data:', err);
      set({
        error: err instanceof Error ? err.message : 'Failed to load workspace',
        isLoading: false,
      });
    }
  },

  createChannel: async (slug, name, isPrivate) => {
    const data = await apiFetch(`/workspaces/${slug}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name, isPrivate }),
    });
    set((state) => ({
      channels: [...state.channels, data.channel],
    }));
  },

  createProject: async (slug, name, key, description) => {
    const data = await apiFetch(`/workspaces/${slug}/projects`, {
      method: 'POST',
      body: JSON.stringify({ name, key, description }),
    });
    set((state) => ({
      projects: [...state.projects, data.project],
    }));
  },

  updateMemberPresence: (userId, data) => {
    set((state) => ({
      members: state.members.map(m => m.userId === userId ? { ...m, ...data } : m)
    }));
  },
}));
