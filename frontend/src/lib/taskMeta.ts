import type { TaskStatus, TaskPriority, IssueType } from '@/types/api';

/**
 * Presentation metadata for the task enums.
 *
 * The values mirror the zod enums in backend/src/modules/tasks/tasks.schemas.ts
 * exactly — `critical | high | medium | low`, not the P0–P3 scheme the older
 * docs describe. Colours come from the domain tokens appended to index.css.
 *
 * The records are the source of truth; the ordered arrays below drive column
 * order and select options.
 */

export const STATUS_META: Record<TaskStatus, { label: string; dot: string }> = {
  todo: { label: 'Todo', dot: 'bg-status-todo' },
  in_progress: { label: 'In Progress', dot: 'bg-status-in-progress' },
  in_review: { label: 'In Review', dot: 'bg-status-in-review' },
  done: { label: 'Done', dot: 'bg-status-done' },
};

/** Board column order, left to right. */
export const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];

export const PRIORITY_META: Record<TaskPriority, { label: string; text: string; dot: string }> = {
  critical: { label: 'Critical', text: 'text-priority-critical', dot: 'bg-priority-critical' },
  high: { label: 'High', text: 'text-priority-high', dot: 'bg-priority-high' },
  medium: { label: 'Medium', text: 'text-priority-medium', dot: 'bg-priority-medium' },
  low: { label: 'Low', text: 'text-priority-low', dot: 'bg-priority-low' },
};

export const PRIORITY_ORDER: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

export const ISSUE_TYPE_META: Record<IssueType, { label: string; glyph: string }> = {
  epic: { label: 'Epic', glyph: '◆' },
  story: { label: 'Story', glyph: '▲' },
  task: { label: 'Task', glyph: '■' },
  bug: { label: 'Bug', glyph: '●' },
  subtask: { label: 'Subtask', glyph: '▸' },
};

export const ISSUE_TYPE_ORDER: IssueType[] = ['task', 'story', 'bug', 'epic', 'subtask'];
