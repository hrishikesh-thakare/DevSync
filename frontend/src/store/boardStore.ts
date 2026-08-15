import { create } from 'zustand';
import { apiFetch } from '../lib/api.js';

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

export interface Task {
  taskId: string;
  taskKey: string;
  title: string;
  status: TaskStatus;
  rank: string; // LexoRank string for ordering
  assigneeId: string | null;
  reporterId?: string;
  sprintId?: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  points: number | null;
  labels: string[];
  type?: string;
  issueType?: string;
  dueDate?: string | Date | null;
}

export interface ProjectMember {
  userId: string;
  fullName: string;
  role: string;
  avatarUrl?: string | null;
}

interface BoardState {
  tasks: Task[];
  members: ProjectMember[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: (slug: string, projectKey: string) => Promise<void>;
  fetchMembers: (slug: string, projectKey: string) => Promise<void>;
  moveTask: (slug: string, projectKey: string, taskKey: string, newStatus: TaskStatus, newRank: string) => Promise<void>;
  updateTaskOptimistic: (taskId: string, newStatus: TaskStatus, newRank: string) => void;
  createTask: (slug: string, projectKey: string, title: string, status: TaskStatus) => Promise<void>;
  updateTaskAssignee: (slug: string, projectKey: string, taskKey: string, assigneeId: string | null) => Promise<void>;
  deleteTask: (slug: string, projectKey: string, taskKey: string) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  tasks: [],
  members: [],
  isLoading: true,
  error: null,

  fetchTasks: async (slug, projectKey) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch(`/workspaces/${slug}/projects/${projectKey}/tasks`);
      // Sort tasks by rank natively just to be safe
      const sorted = (data.tasks || []).sort((a: Task, b: Task) => a.rank.localeCompare(b.rank));
      set({ tasks: sorted, isLoading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchMembers: async (slug, projectKey) => {
    try {
      const data = await apiFetch(`/workspaces/${slug}/projects/${projectKey}/members`);
      set({ members: data.members || [] });
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  },

  // Optimistic UI update before the API call finishes
  updateTaskOptimistic: (taskId, newStatus, newRank) => {
    set((state) => ({
      tasks: state.tasks.map((t) => 
        t.taskId === taskId ? { ...t, status: newStatus, rank: newRank } : t
      ).sort((a, b) => a.rank.localeCompare(b.rank))
    }));
  },

  // The actual API call
  moveTask: async (slug, projectKey, taskKey, newStatus, newRank) => {
    try {
      await apiFetch(`/workspaces/${slug}/projects/${projectKey}/tasks/${taskKey}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, rank: newRank }),
      });
    } catch (err) {
      console.error('Failed to move task on server. Re-fetching to sync state...', err);
      get().fetchTasks(slug, projectKey);
    }
  },

  createTask: async (slug, projectKey, title, status) => {
    try {
      await apiFetch(`/workspaces/${slug}/projects/${projectKey}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ 
          title, 
          status,
          type: 'task',
          priority: 'medium'
        }),
      });
      get().fetchTasks(slug, projectKey);
    } catch (err) {
      console.error('Failed to create task:', err);
      throw err;
    }
  },

  updateTaskAssignee: async (slug, projectKey, taskKey, assigneeId) => {
    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((t) => (t.taskKey === taskKey ? { ...t, assigneeId } : t))
    }));

    try {
      await apiFetch(`/workspaces/${slug}/projects/${projectKey}/tasks/${taskKey}`, {
        method: 'PATCH',
        body: JSON.stringify({ assigneeId }),
      });
    } catch (err) {
      console.error('Failed to update task assignee:', err);
      get().fetchTasks(slug, projectKey);
    }
  },

  deleteTask: async (slug, projectKey, taskKey) => {
    // Optimistic update
    set((state) => ({
      tasks: state.tasks.filter((t) => t.taskKey !== taskKey)
    }));

    try {
      await apiFetch(`/workspaces/${slug}/projects/${projectKey}/tasks/${taskKey}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete task:', err);
      get().fetchTasks(slug, projectKey);
    }
  },
}));
