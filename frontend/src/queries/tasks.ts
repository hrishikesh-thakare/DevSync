import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateKeyBetween } from 'fractional-indexing';
import { apiFetch } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import type { CreateTaskInput, TaskStatus, TaskSummary } from '@/types/api';

export type { TaskSummary, CreateTaskInput } from '@/types/api';

/**
 * The project task list, as a TanStack Query cache entry.
 *
 * This replaces the old `useTaskStore` (plain Zustand + hand-rolled
 * `fetchTasks`/`reset`). That store reset to `isLoading: true` on every
 * unmount, so five pages sharing it — Board, Backlog, the sprint board, the
 * task detail panel, the create-task dialog — each re-fetched identical data
 * on every mount: Board → Backlog → Board was three full round trips and
 * three skeletons for one project's worth of tasks. Keying the cache on
 * `[slug, key]` with a 5-minute `staleTime` (set on the shared `queryClient`)
 * means the second and third of those renders come straight from cache.
 *
 * Anything that used to reach into `useTaskStore.setState` from outside a
 * component (`labelStore`'s rename propagation, `taskDetailStore`'s edit/
 * delete sync, the socket `task_updated` handler in `ProjectLayout`) now
 * calls `queryClient.setQueryData` on this same key instead — the functions
 * at the bottom of this file wrap that so call sites don't touch the client
 * directly.
 */
export const taskKeys = {
  list: (slug: string, key: string) => ['tasks', slug, key] as const,
};

/**
 * A stable fallback for `data: tasks = EMPTY_TASKS`. `useQuery`'s `data` is
 * `undefined` until the first fetch resolves, and a `[]` literal written
 * inline at the destructure would be a *new* array on every render during
 * that window — which then fails a `useMemo`/`useEffect`'s reference-equality
 * check on every single render and can spin into a render loop before the
 * fetch ever completes. One module-level array avoids that entirely.
 */
export const EMPTY_TASKS: TaskSummary[] = [];

async function fetchTasks(slug: string, key: string): Promise<TaskSummary[]> {
  const data = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks`);
  return data.tasks ?? [];
}

export function useTasksQuery(slug: string, key: string) {
  return useQuery({
    queryKey: taskKeys.list(slug, key),
    queryFn: () => fetchTasks(slug, key),
    enabled: Boolean(slug && key),
  });
}

export function useCreateTaskMutation(slug: string, key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const data = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      // POST returns the full task row; the board only needs the summary
      // shape, and the fields the list endpoint joins in are not on that row.
      const created: TaskSummary = {
        ...data.task,
        assigneeName: null,
        assigneeAvatar: null,
        linkedCommitsCount: 0,
        labels: data.task.labels ?? [],
      };
      return created;
    },
    onSuccess: (created) => {
      client.setQueryData<TaskSummary[]>(taskKeys.list(slug, key), (old = []) => [...old, created]);
    },
  });
}

interface MoveTaskInput {
  taskId: string;
  status: TaskStatus;
  afterTaskId: string | null;
  beforeTaskId: string | null;
}

export function useMoveTaskMutation(slug: string, key: string) {
  const client = useQueryClient();
  const listKey = taskKeys.list(slug, key);

  return useMutation({
    mutationFn: async ({ taskId, status, afterTaskId, beforeTaskId }: MoveTaskInput) => {
      const data = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskId}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ status, afterTaskId, beforeTaskId }),
      });
      return data.task as TaskSummary;
    },

    // Move optimistically so the card lands where it was dropped. Patching
    // `status` alone is not enough: the card would keep its old rank, sort to
    // wherever that stale value falls among its new column's siblings
    // (visibly the wrong slot), then jump again once the PATCH returns the
    // real rank. Two snaps per drag, which reads as lag even when the request
    // is fast.
    //
    // So compute the same rank the server will, from the same neighbours the
    // caller already resolved, with the same library the backend uses. This
    // can only diverge if another client's move races it, and `onSuccess`
    // below adopts the server's authoritative rank regardless.
    onMutate: async ({ taskId, status, afterTaskId, beforeTaskId }) => {
      await client.cancelQueries({ queryKey: listKey });
      const previous = client.getQueryData<TaskSummary[]>(listKey) ?? [];

      let optimisticRank: string | undefined;
      if (afterTaskId || beforeTaskId) {
        const byId = new Map(previous.map((t) => [t.taskId, t]));
        const afterRank = afterTaskId ? (byId.get(afterTaskId)?.rank ?? null) : null;
        const beforeRank = beforeTaskId ? (byId.get(beforeTaskId)?.rank ?? null) : null;
        try {
          optimisticRank = generateKeyBetween(afterRank, beforeRank);
        } catch {
          // Tied neighbours. The server resolves this by appending after the
          // tied run rather than erroring, so mirror that here.
          try {
            optimisticRank = generateKeyBetween(afterRank, null);
          } catch {
            // Nothing sensible to guess — let the response settle it.
          }
        }
      } else {
        // Dropped with no neighbours at all, i.e. the only card in an empty
        // column — any key works since there is nothing to sort against.
        optimisticRank = generateKeyBetween(null, null);
      }

      client.setQueryData<TaskSummary[]>(listKey, (old = []) =>
        old.map((t) =>
          t.taskId === taskId ? { ...t, status, ...(optimisticRank ? { rank: optimisticRank } : {}) } : t,
        ),
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Self-healing revert: restoring the cache here is what lets BoardPage
      // and BacklogPage skip any revert logic of their own — they re-render
      // straight off the query result.
      if (context) client.setQueryData(listKey, context.previous);
    },

    onSuccess: (updated) => {
      // Adopt the server's fractional index, otherwise the next drag computes
      // neighbours from a stale rank and positions drift over a session.
      client.setQueryData<TaskSummary[]>(listKey, (old = []) =>
        old.map((t) => (t.taskId === updated.taskId ? { ...t, rank: updated.rank, status: updated.status } : t)),
      );
    },
  });
}

/** Applied from the `task_updated` socket handler in `ProjectLayout`. */
export function applyTaskUpdate(slug: string, key: string, update: Partial<TaskSummary> & { taskId: string }) {
  queryClient.setQueryData<TaskSummary[]>(taskKeys.list(slug, key), (old) => {
    if (!old) return old;
    const exists = old.some((t) => t.taskId === update.taskId);
    if (!exists) return old; // Only update if we already have it in the board
    return old.map((t) => (t.taskId === update.taskId ? { ...t, ...update } : t));
  });
}

/** Applied from `taskDetailStore.patchTask`, to keep a board behind the panel in step with the edit. */
export function patchCachedTask(slug: string, key: string, task: TaskSummary) {
  queryClient.setQueryData<TaskSummary[]>(taskKeys.list(slug, key), (old) => {
    if (!old) return old;
    return old.map((t) =>
      t.taskId === task.taskId
        ? {
            ...t,
            title: task.title,
            status: task.status,
            priority: task.priority,
            issueType: task.issueType,
            assigneeId: task.assigneeId,
            storyPoints: task.storyPoints,
            sprintId: task.sprintId,
            labels: task.labels ?? [],
          }
        : t,
    );
  });
}

/** Applied from `taskDetailStore.deleteTask`. */
export function removeCachedTask(slug: string, key: string, taskId: string) {
  queryClient.setQueryData<TaskSummary[]>(taskKeys.list(slug, key), (old) => old?.filter((t) => t.taskId !== taskId));
}

/**
 * Applies a label rename (or removal, when `to` is null) to whatever board is
 * already cached, matching case-insensitively the way the server does. See
 * `labelStore.ts` for why this has to touch the task list at all: a task's
 * `labels` column is a plain array of strings, not a foreign key, and the
 * server rewrites those strings in every task row in the same request that
 * renames the catalogue entry.
 */
export function renameCachedTaskLabel(slug: string, key: string, from: string, to: string | null) {
  const lower = from.toLowerCase();
  queryClient.setQueryData<TaskSummary[]>(taskKeys.list(slug, key), (old) => {
    if (!old) return old;
    return old.map((task) => {
      const labels = task.labels ?? [];
      if (!labels.some((l) => l.toLowerCase() === lower)) return task;
      return {
        ...task,
        labels:
          to === null
            ? labels.filter((l) => l.toLowerCase() !== lower)
            : labels.map((l) => (l.toLowerCase() === lower ? to : l)),
      };
    });
  });
}

/** Board ordering: tasks arrive ranked, and `rank` is a plain lexicographic key. */
export function byRank(a: TaskSummary, b: TaskSummary) {
  return (a.rank ?? '').localeCompare(b.rank ?? '');
}
