import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { hotkeysCoreFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { ArrowRightIcon, NetworkIcon } from 'lucide-react';

import { EmptyState } from '@/components/layout/PageState';
import { Tree, TreeItem, TreeItemLabel } from '@/components/reui/tree';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTaskStore } from '@/store/taskStore';
import { ISSUE_TYPE_META } from '@/lib/taskMeta';
import type { TaskSummary } from '@/types/api';

const ROOT_ID = '__root__';
const INDENT = 20;

/** A stand-in for the root the tree library requires; never itself rendered. */
const ROOT_TASK: TaskSummary = {
  taskId: ROOT_ID,
  taskKey: '',
  title: 'Epics',
  issueType: 'epic',
  status: 'todo',
  priority: 'medium',
  rank: null,
  dueDate: null,
  labels: [],
  storyPoints: null,
  sprintId: null,
  assigneeId: null,
  assigneeName: null,
  assigneeAvatar: null,
  reporterId: null,
  linkedCommitsCount: 0,
  createdAt: '',
  parentTaskId: null,
  epicId: null,
};

/**
 * Epic → subtask hierarchy. `parentTaskId` and `epicId` have been on the wire
 * since `getTask` for a while — `TaskDetailPage` reads them for the reporter/
 * epic-link fields — but nothing ever showed the tree they describe; you could
 * only see one task's single parent, never an epic's whole set of children.
 *
 * Only tasks that actually participate in a parent/epic relationship are
 * shown — this is a hierarchy browser, not another copy of the backlog, so a
 * project that never links tasks to epics shows the empty state below rather
 * than every ordinary task dumped in flat.
 */
export function ProjectEpicsPage() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { tasks, fetchTasks, reset } = useTaskStore();

  useEffect(() => {
    if (slug && key) void fetchTasks(slug, key);
    return () => reset();
  }, [slug, key, fetchTasks, reset]);

  const { byId, childrenOf, rootIds } = useMemo(() => {
    const byId = new Map<string, TaskSummary>(tasks.map((t) => [t.taskId, t]));
    const byParent = new Map<string, string[]>();
    const byEpic = new Map<string, string[]>();

    for (const t of tasks) {
      if (t.parentTaskId && byId.has(t.parentTaskId)) {
        const list = byParent.get(t.parentTaskId) ?? [];
        list.push(t.taskId);
        byParent.set(t.parentTaskId, list);
      } else if (t.epicId && byId.has(t.epicId)) {
        // Only tasks with no parent of their own fall in directly under the
        // epic — a task that has both is reached through its parent instead,
        // so it is never listed twice.
        const list = byEpic.get(t.epicId) ?? [];
        list.push(t.taskId);
        byEpic.set(t.epicId, list);
      }
    }

    const childrenOf = (id: string): string[] => [...(byParent.get(id) ?? []), ...(byEpic.get(id) ?? [])];

    const rootIds = tasks
      .filter((t) => !t.parentTaskId && (t.issueType === 'epic' || byParent.has(t.taskId) || byEpic.has(t.taskId)))
      .map((t) => t.taskId);

    return { byId, childrenOf, rootIds };
  }, [tasks]);

  const tree = useTree<TaskSummary>({
    rootItemId: ROOT_ID,
    indent: INDENT,
    // Epics open by default — one level deep is the useful default view; a
    // reader can still collapse ones they don't care about.
    initialState: { expandedItems: rootIds },
    getItemName: (item) => item.getItemData()?.title ?? '',
    isItemFolder: (item) => childrenOf(item.getId()).length > 0,
    dataLoader: {
      getItem: (id) => (id === ROOT_ID ? ROOT_TASK : (byId.get(id) ?? ROOT_TASK)),
      getChildren: (id) => (id === ROOT_ID ? rootIds : childrenOf(id)),
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  if (rootIds.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <EmptyState
          icon={<NetworkIcon aria-hidden="true" />}
          title="No epics linked yet"
          description="Set a task's issue type to Epic, then point other tasks' Epic link at it from their detail page — the hierarchy shows up here."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <Tree indent={INDENT} tree={tree} className="rounded-xl border p-2">
        {tree.getItems().map((item) => {
          if (item.getId() === ROOT_ID) return null;
          const task = item.getItemData();
          const type = ISSUE_TYPE_META[task.issueType];

          return (
            <TreeItem key={item.getId()} item={item} asChild>
              <div className="group/row flex items-center justify-between gap-2 rounded-lg pr-1 hover:bg-muted">
                <TreeItemLabel className="min-w-0 flex-1 gap-2 py-1.5">
                  <span aria-hidden="true">{type?.glyph}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{task.taskKey}</span>
                  <span className="truncate text-sm">{task.title}</span>
                  {task.issueType === 'epic' ? (
                    <Badge variant="secondary" className="shrink-0">
                      Epic
                    </Badge>
                  ) : null}
                </TreeItemLabel>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 opacity-0 group-hover/row:opacity-100"
                  aria-label={`Open ${task.taskKey}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/w/${slug}/projects/${key}/tasks/${task.taskKey}`);
                  }}
                >
                  <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </TreeItem>
          );
        })}
      </Tree>
    </div>
  );
}
