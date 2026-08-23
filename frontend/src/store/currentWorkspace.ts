import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

import type {
  ProjectSummary,
  Channel,
  ChannelType,
  WorkspaceMember,
  WorkspaceRole,
  Presence,
} from '@/types/api';

// Re-exported so consumers can keep importing these from the store they use.
export type { WorkspaceMember, WorkspaceRole, ProjectRole } from '@/types/api';

interface CurrentWorkspaceState {
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  myRole: WorkspaceRole;
  memberCount: number;
  members: WorkspaceMember[];
  projects: ProjectSummary[];
  channels: Channel[];
  isLoading: boolean;
  error: string | null;
  // Helpers
  isAdmin: () => boolean;
  isOwner: () => boolean;
  // Actions
  fetchWorkspaceData: (slug: string) => Promise<void>;
  createChannel: (slug: string, name: string, type?: ChannelType, projectId?: string | null) => Promise<Channel>;
  updateChannel: (slug: string, channelId: string, patch: { name?: string; description?: string }) => Promise<void>;
  archiveChannel: (slug: string, channelId: string) => Promise<void>;
  deleteChannel: (slug: string, channelId: string) => Promise<void>;
  joinChannel: (slug: string, channelId: string) => Promise<void>;
  leaveChannel: (slug: string, channelId: string) => Promise<void>;
  createProject: (slug: string, name: string, key: string, description?: string) => Promise<void>;
  updateMemberPresence: (userId: string, data: { presence?: Presence; statusText?: string; statusEmoji?: string }) => void;
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

      // Determine current user's role from the members list. A static import
      // is fine here: auth.ts pulls in nothing from this module, so there is
      // no cycle for the dynamic import to break.
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

  // The backend schema is .strict() and keys off `type`, not an `isPrivate`
  // boolean — sending the latter fails validation outright.
  createChannel: async (slug, name, type = 'public', projectId = null) => {
    const data = await apiFetch(`/workspaces/${slug}/channels`, {
      method: 'POST',
      body: JSON.stringify(projectId ? { name, type, projectId } : { name, type }),
    });
    set((state) => ({
      channels: [...state.channels, data.channel],
    }));
    return data.channel as Channel;
  },

  updateChannel: async (slug, channelId, patch) => {
    // `updateChannelSchema` is .strict(): name and description only. Type,
    // project scope and the announcement flag are fixed at creation.
    const data = await apiFetch(`/workspaces/${slug}/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    set((state) => ({
      channels: state.channels.map((c) => (c.channelId === channelId ? data.channel : c)),
    }));
  },

  archiveChannel: async (slug, channelId) => {
    await apiFetch(`/workspaces/${slug}/channels/${channelId}/archive`, { method: 'PATCH' });
    // `listChannels` filters archived channels out entirely, so dropping the
    // row here matches what a refetch would return.
    set((state) => ({ channels: state.channels.filter((c) => c.channelId !== channelId) }));
  },

  deleteChannel: async (slug, channelId) => {
    await apiFetch(`/workspaces/${slug}/channels/${channelId}`, { method: 'DELETE' });
    set((state) => ({ channels: state.channels.filter((c) => c.channelId !== channelId) }));
  },

  joinChannel: async (slug, channelId) => {
    await apiFetch(`/workspaces/${slug}/channels/${channelId}/join`, { method: 'POST' });
  },

  leaveChannel: async (slug, channelId) => {
    await apiFetch(`/workspaces/${slug}/channels/${channelId}/leave`, { method: 'DELETE' });
    // Leaving a *private* channel removes it from `listChannels` for this user;
    // a public one stays visible. Refetching is the only way to know which,
    // short of duplicating the server's visibility rules here.
    await get().fetchWorkspaceData(slug);
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
