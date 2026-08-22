import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import { useTaskStore } from '@/store/taskStore';
import type {
  LinkedCommit,
  Task,
  TaskAttachment,
  TaskComment,
  TaskPriority,
  TaskStatus,
  IssueType,
} from '@/types/api';

/** Fields the detail panel can edit — a subset of the `.strict()` updateTaskSchema. */
export interface TaskPatch {
  title?: string;
  descriptionText?: string;
  issueType?: IssueType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  storyPoints?: number | null;
  sprintId?: string | null;
  labels?: string[];
  dueDate?: string | null;
}

interface TaskDetailState {
  task: Task | null;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  commits: LinkedCommit[];
  isLoading: boolean;
  error: string | null;

  fetchTask: (slug: string, key: string, taskKey: string) => Promise<void>;
  patchTask: (slug: string, key: string, taskKey: string, patch: TaskPatch) => Promise<void>;
  addComment: (slug: string, key: string, taskKey: string, bodyText: string) => Promise<void>;
  deleteTask: (slug: string, key: string, taskKey: string) => Promise<void>;
  reset: () => void;
}

export const useTaskDetailStore = create<TaskDetailState>((set, get) => ({
  task: null,
  comments: [],
  attachments: [],
  commits: [],
  isLoading: true,
  error: null,

  fetchTask: async (slug, key, taskKey) => {
    set({ isLoading: true, error: null });
    const base = `/workspaces/${slug}/projects/${key}/tasks/${taskKey}`;
    try {
      const data = await apiFetch(base);

      // The side panels are supporting detail: a failure in any of them should
      // not blank out the task itself, so they settle independently.
      const [comments, attachments, commits] = await Promise.allSettled([
        apiFetch(`${base}/comments`),
        apiFetch(`${base}/attachments`),
        apiFetch(`${base}/github/commits`),
      ]);

      set({
        task: data.task,
        comments: comments.status === 'fulfilled' ? (comments.value.comments ?? []) : [],
        attachments: attachments.status === 'fulfilled' ? (attachments.value.attachments ?? []) : [],
        commits: commits.status === 'fulfilled' ? (commits.value.commits ?? []) : [],
        isLoading: false,
      });
    } catch (err) {
      set({
        task: null,
        error: err instanceof Error ? err.message : 'Could not load this task.',
        isLoading: false,
      });
    }
  },

  patchTask: async (slug, key, taskKey, patch) => {
    const data = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    set({ task: data.task });

    // Keep a board rendered behind this panel in step with the edit.
    useTaskStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.taskId === data.task.taskId
          ? {
              ...t,
              title: data.task.title,
              status: data.task.status,
              priority: data.task.priority,
              issueType: data.task.issueType,
              assigneeId: data.task.assigneeId,
              storyPoints: data.task.storyPoints,
              sprintId: data.task.sprintId,
              labels: data.task.labels ?? [],
            }
          : t,
      ),
    }));
  },

  addComment: async (slug, key, taskKey, bodyText) => {
    const data = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}/comments`, {
      method: 'POST',
      body: JSON.stringify({ bodyText }),
    });
    set((state) => ({ comments: [...state.comments, data.comment] }));
  },

  deleteTask: async (slug, key, taskKey) => {
    const taskId = get().task?.taskId;
    await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}`, { method: 'DELETE' });
    if (taskId) {
      useTaskStore.setState((state) => ({ tasks: state.tasks.filter((t) => t.taskId !== taskId) }));
    }
  },

  reset: () => set({ task: null, comments: [], attachments: [], commits: [], isLoading: true, error: null }),
}));
