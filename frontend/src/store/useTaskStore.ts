import { create } from 'zustand';
import { Task, TaskStatus } from '../types';
import { apiFetch } from '../lib/api';
import { useWorkspaceStore } from './workspaceStore';
import { useProjectStore } from './useProjectStore';
import { useCurrentWorkspaceStore } from './currentWorkspace';


interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  fetchTasks: (targetProjectKey?: string) => Promise<void>;

  createTask: (title: string, description: string, status: TaskStatus) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  updateTaskSprint: (taskId: string, sprintId: string | null) => Promise<void>;
  updateTaskAssignee: (taskId: string, assigneeId: string | null) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,

  fetchTasks: async (targetProjectKey?: string) => {
    let slug = useWorkspaceStore.getState().currentWorkspace?.slug;
    const cw = useCurrentWorkspaceStore.getState();
    slug = slug || cw.slug;
    if (!slug) return;

    set({ isLoading: true });
    try {
      const activeProj = useProjectStore.getState().activeProject as { projectKey?: string; key?: string } | null;
      const activeProjectKey = targetProjectKey || activeProj?.projectKey || activeProj?.key;

      let allTasks: Task[] = [];

      if (activeProjectKey) {
        interface RawTask {
          taskId: string;
          taskKey?: string;
          title: string;
          description?: string | null;
          status: string;
          priority?: string;
          type?: string;
          assigneeId?: string | null;
          reporterId?: string | null;
          sprintId?: string | null;
          createdAt: string;
        }
        const data = await apiFetch(`/workspaces/${slug}/projects/${activeProjectKey}/tasks`);
        allTasks = (data.tasks || []).map((t: RawTask) => ({
          id: t.taskId,
          taskKey: t.taskKey,
          title: t.title,
          description: t.description || '',
          status: t.status as TaskStatus,
          priority: (t.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium',
          type: (t.type as 'task' | 'bug' | 'feature' | 'epic') || 'task',

          assigneeId: t.assigneeId || null,
          reporterId: t.reporterId || '',
          sprintId: t.sprintId || null,
          createdAt: t.createdAt
        }));
      }

      set({ tasks: allTasks, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      set({ isLoading: false });
    }
  },



  createTask: async (title, description, status) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    const project = useProjectStore.getState().activeProject;
    
    if (!workspace || !project) return;

    try {
      await apiFetch(`/workspaces/${workspace.slug}/projects/${project.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          status,
          type: 'task',
          priority: 'medium'
        })
      });
      get().fetchTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  },

  updateTaskStatus: async (taskId, status) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    const project = useProjectStore.getState().activeProject;
    
    if (!workspace || !project) return;

    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status } : t))
    }));

    try {
      await apiFetch(`/workspaces/${workspace.slug}/projects/${project.id}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    } catch (err) {
      console.error('Failed to update task:', err);
      // Revert on failure by refetching
      get().fetchTasks();
    }
  },

  updateTaskSprint: async (taskId, sprintId) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    const project = useProjectStore.getState().activeProject;
    
    if (!workspace || !project) return;

    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, sprintId } : t))
    }));

    try {
      await apiFetch(`/workspaces/${workspace.slug}/projects/${project.id}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ sprintId })
      });
    } catch (err) {
      console.error('Failed to update task sprint:', err);
      get().fetchTasks();
    }
  },

  updateTaskAssignee: async (taskId, assigneeId) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    const project = useProjectStore.getState().activeProject;
    
    if (!workspace || !project) return;

    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, assigneeId } : t))
    }));

    try {
      await apiFetch(`/workspaces/${workspace.slug}/projects/${project.id}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ assigneeId })
      });
    } catch (err) {
      console.error('Failed to update task assignee:', err);
      get().fetchTasks();
    }
  },

  deleteTask: async (taskId) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    const project = useProjectStore.getState().activeProject;
    
    if (!workspace || !project) return;

    // Optimistic delete
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId)
    }));

    try {
      await apiFetch(`/workspaces/${workspace.slug}/projects/${project.id}/tasks/${taskId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete task:', err);
      get().fetchTasks();
    }
  }
}));
