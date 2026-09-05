import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { useAuthStore } from '@/store/auth';
import type { Project, ProjectMember, ProjectRole } from '@/types/api';

export type { Project, ProjectMember, ProjectRole } from '@/types/api';

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: 'active' | 'archived';
}

interface ProjectState {
  project: Project | null;
  members: ProjectMember[];
  isLoading: boolean;
  error: string | null;

  fetchProject: (slug: string, key: string) => Promise<void>;
  refreshMembers: (slug: string, key: string) => Promise<void>;
  createProject: (slug: string, input: CreateProjectInput) => Promise<Project>;
  updateProject: (slug: string, key: string, input: UpdateProjectInput) => Promise<Project>;
  archiveProject: (slug: string, key: string) => Promise<void>;
  deleteProject: (slug: string, key: string) => Promise<void>;

  addMember: (slug: string, key: string, userId: string, role: ProjectRole) => Promise<void>;
  updateMemberRole: (slug: string, key: string, userId: string, role: ProjectRole) => Promise<void>;
  removeMember: (slug: string, key: string, userId: string) => Promise<void>;

  reset: () => void;
}

/** Holds the project currently open in `ProjectLayout`, plus its member roster. */
export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  members: [],
  isLoading: true,
  error: null,

  fetchProject: async (slug, key) => {
    set({ isLoading: true, error: null });
    try {
      // GET /:key already returns the member list, so this is one round trip.
      const data = await apiFetch(`/workspaces/${slug}/projects/${key}`);
      set({
        project: data.project,
        members: data.members ?? [],
        isLoading: false,
      });
    } catch (err) {
      set({
        project: null,
        members: [],
        error: err instanceof Error ? err.message : 'Could not load this project.',
        isLoading: false,
      });
    }
  },

  refreshMembers: async (slug, key) => {
    const data = await apiFetch(`/workspaces/${slug}/projects/${key}/members`);
    set({ members: data.members ?? [] });
  },

  createProject: async (slug, input) => {
    // createProjectSchema is .strict() — name, key, description, iconUrl only.
    const body: CreateProjectInput = { name: input.name, key: input.key };
    if (input.description) body.description = input.description;

    const data = await apiFetch(`/workspaces/${slug}/projects`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // Keep the shell's sidebar in step without a full workspace refetch.
    useCurrentWorkspaceStore.setState((state) => ({
      projects: [
        ...state.projects,
        {
          projectId: data.project.projectId,
          name: data.project.name,
          key: data.project.key,
          description: data.project.description,
          iconUrl: data.project.iconUrl,
          status: data.project.status,
          issueCounter: data.project.issueCounter,
          createdAt: data.project.createdAt,
          leadName: null,
          leadAvatar: null,
        },
      ],
    }));

    return data.project as Project;
  },

  updateProject: async (slug, key, input) => {
    const data = await apiFetch(`/workspaces/${slug}/projects/${key}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    set({ project: data.project });

    useCurrentWorkspaceStore.setState((state) => ({
      projects: state.projects.map((p) =>
        p.projectId === data.project.projectId
          ? { ...p, name: data.project.name, description: data.project.description }
          : p,
      ),
    }));

    return data.project as Project;
  },

  archiveProject: async (slug, key) => {
    const data = await apiFetch(`/workspaces/${slug}/projects/${key}/archive`, { method: 'PATCH' });
    set({ project: data.project });

    // The list endpoint only returns active projects, so drop it from the sidebar.
    useCurrentWorkspaceStore.setState((state) => ({
      projects: state.projects.filter((p) => p.projectId !== data.project.projectId),
    }));
  },

  deleteProject: async (slug, key) => {
    const projectId = get().project?.projectId;
    await apiFetch(`/workspaces/${slug}/projects/${key}`, { method: 'DELETE' });
    set({ project: null, members: [] });

    if (projectId) {
      useCurrentWorkspaceStore.setState((state) => ({
        projects: state.projects.filter((p) => p.projectId !== projectId),
      }));
    }
  },

  addMember: async (slug, key, userId, role) => {
    await apiFetch(`/workspaces/${slug}/projects/${key}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    });
    await get().refreshMembers(slug, key);
  },

  updateMemberRole: async (slug, key, userId, role) => {
    await apiFetch(`/workspaces/${slug}/projects/${key}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
    set((state) => ({
      members: state.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
    }));
  },

  removeMember: async (slug, key, userId) => {
    await apiFetch(`/workspaces/${slug}/projects/${key}/members/${userId}`, { method: 'DELETE' });
    set((state) => ({ members: state.members.filter((m) => m.userId !== userId) }));
  },

  reset: () => set({ project: null, members: [], isLoading: true, error: null }),
}));

/**
 * The effective project role for the signed-in user.
 *
 * Mirrors backend/src/middleware/roles.ts: a workspace `owner` or `admin` is
 * implicitly `project_admin` on every project, without a `project_members` row.
 * Deriving this on the client keeps the UI from offering actions the server
 * would refuse — and from hiding ones it would allow.
 */
export function useMyProjectRole(): ProjectRole | null {
  const members = useProjectStore((s) => s.members);
  const userId = useAuthStore((s) => s.user?.userId);
  const workspaceRole = useCurrentWorkspaceStore((s) => s.myRole);

  if (workspaceRole === 'owner' || workspaceRole === 'admin') return 'project_admin';
  if (!userId) return null;
  return members.find((m) => m.userId === userId)?.role ?? null;
}
