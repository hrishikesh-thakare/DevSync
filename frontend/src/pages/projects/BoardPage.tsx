import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBoardStore, Task, TaskStatus } from '../../store/boardStore.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { Loader2, AlertCircle, Plus, X, Bug, BookOpen, Zap, CheckSquare, Layers, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../store/auth.js';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { LabelChip } from '../../components/projects/LabelChip.js';
import { useLabelStore } from '../../store/labelStore.js';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'todo', title: 'To Do', color: 'bg-gray-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-500' },
  { id: 'in_review', title: 'In Review', color: 'bg-yellow-500' },
  { id: 'done', title: 'Done', color: 'bg-emerald-500' },
];

const ISSUE_TYPES = [
  { value: 'epic', label: 'Epic', icon: Zap, color: 'text-purple-400' },
  { value: 'story', label: 'Story', icon: BookOpen, color: 'text-blue-400' },
  { value: 'task', label: 'Task', icon: CheckSquare, color: 'text-gray-300' },
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-red-400' },
  { value: 'subtask', label: 'Subtask', icon: Layers, color: 'text-gray-500' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
];

const IssueTypeIcon = ({ type, className = '' }: { type: string; className?: string }) => {
  const found = ISSUE_TYPES.find(t => t.value === type);
  if (!found) return <CheckSquare className={clsx("w-4 h-4", className)} />;
  const Icon = found.icon;
  return <Icon className={clsx("w-4 h-4", found.color, className)} />;
};

export const BoardPage = ({ sprintId }: { sprintId?: string }) => {
  const { slug, key } = useParams();
  const toast = useToast();
  const { tasks, members, isLoading, fetchTasks, fetchMembers, updateTaskOptimistic, moveTask } = useBoardStore();
  const { isAdmin } = useCurrentWorkspaceStore();
  const currentUser = useAuthStore(state => state.user);

  const myMembership = members.find(m => m.userId === currentUser?.userId);
  const canEditTask = isAdmin() || (myMembership && myMembership.role !== 'viewer');

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo');
  const [newTaskType, setNewTaskType] = useState('task');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskLabels, setNewTaskLabels] = useState('');
  const [newTaskSprintId, setNewTaskSprintId] = useState<string>(sprintId || '');
  const [newTaskPoints, setNewTaskPoints] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const [sprints, setSprints] = useState<{ sprintId: string; name: string }[]>([]);

  const labels = useLabelStore(state => state.labels);
  const fetchLabels = useLabelStore(state => state.fetchLabels);
  const labelNames = labels.map(l => l.name);

  // Filters
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (slug && key) {
      fetchTasks(slug, key);
      fetchMembers(slug, key);
      fetchLabels(slug, key);
      import('../../lib/api.js').then(({ apiFetch }) => {
        apiFetch(`/workspaces/${slug}/projects/${key}/sprints`)
          .then(data => setSprints(data.sprints || []))
          .catch(err => console.error('Failed to load sprints', err));
      });
    }
  }, [slug, key, fetchTasks, fetchMembers, fetchLabels]);
  
  // removed useEffect to prevent cascading renders

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !slug || !key) return;
    setIsCreatingTask(true);
    try {
      const { apiFetch } = await import('../../lib/api.js');
      await apiFetch(`/workspaces/${slug}/projects/${key}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: newTaskTitle,
          status: newTaskStatus,
          issueType: newTaskType,
          priority: newTaskPriority,
          description: newTaskDescription || undefined,
          labels: newTaskLabels ? newTaskLabels.split(',').map(l => l.trim()).filter(Boolean) : [],
          sprintId: newTaskSprintId || undefined,
          storyPoints: newTaskPoints !== '' ? parseInt(newTaskPoints) : null,
        }),
      });
      await useBoardStore.getState().fetchTasks(slug, key);
      setShowTaskModal(false);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskLabels('');
      setNewTaskType('task');
      setNewTaskPriority('medium');
      setNewTaskSprintId(sprintId || '');
      setNewTaskPoints('');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to create task.');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Apply filters
  let filteredTasks = tasks;
  if (sprintId) {
    filteredTasks = filteredTasks.filter(t => t.sprintId === sprintId);
  }
  if (filterPriority !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.priority === filterPriority);
  }
  if (filterType !== 'all') {
    filteredTasks = filteredTasks.filter(t => (t.type || t.issueType || 'task') === filterType);
  }

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEditTask) return;
    const { active } = event;
    const task = filteredTasks.find((t) => t.taskId === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = () => {
    // Handled in DragEnd for simplicity
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canEditTask) return;
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !slug || !key) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTaskData = tasks.find(t => t.taskId === activeId);
    if (!activeTaskData) return;

    const isOverColumn = COLUMNS.some(c => c.id === overId);
    const newStatus = isOverColumn ? (overId as TaskStatus) : tasks.find(t => t.taskId === overId)?.status || activeTaskData.status;
    
    if (activeTaskData.status === newStatus && activeId === overId) return;

    const newRank = Math.random().toString(36).substring(2, 10);

    updateTaskOptimistic(activeId, newStatus, newRank);
    moveTask(slug, key, activeTaskData.taskKey, newStatus, newRank);
  };

  const hasActiveFilters = filterPriority !== 'all' || filterType !== 'all';

  return (
    <div className="h-full flex flex-col">
      {/* Filter Bar */}
      <div className="px-6 pt-4 pb-2 flex items-center space-x-3 shrink-0">
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(
            "flex items-center text-sm px-3 py-1.5 rounded-lg border transition-colors",
            hasActiveFilters ? "border-white/30 text-white bg-white/10" : "border-gray-800 text-gray-400 hover:text-gray-200 bg-gray-900"
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 mr-2" />
          Filters
          {hasActiveFilters && <span className="ml-2 w-1.5 h-1.5 bg-white rounded-full"></span>}
        </button>

        {showFilters && (
          <>
            <select 
              value={filterPriority} 
              onChange={e => setFilterPriority(e.target.value)}
              className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="all">All Priorities</option>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value)}
              className="bg-gray-900 border border-gray-800 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="all">All Types</option>
              {ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {hasActiveFilters && (
              <button 
                onClick={() => { setFilterPriority('all'); setFilterType('all'); }}
                className="text-xs text-gray-500 hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </>
        )}

        <div className="flex-1" />
        <div className="flex items-center space-x-3">
          {canEditTask && (
            <button 
              onClick={() => { setNewTaskStatus('todo'); setShowTaskModal(true); }}
              className="flex items-center px-3 py-2 bg-white hover:bg-gray-200 text-gray-950 text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Task
            </button>
          )}
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 p-6 pt-2 inline-flex items-start gap-6 relative min-w-full overflow-x-auto">
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {COLUMNS.map(col => {
            const columnTasks = filteredTasks.filter(t => t.status === col.id);
            return (
              <KanbanColumn 
                key={col.id} 
                column={col} 
                tasks={columnTasks} 
                onAddClick={() => {
                  setNewTaskStatus(col.id as TaskStatus);
                  setShowTaskModal(true);
                }} 
              />
            );
          })}

          <DragOverlay>
            {activeTask ? <KanbanCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* CREATE TASK MODAL — Full fields */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
              <h3 className="text-xl font-bold text-white">Create Task</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title *</label>
                <input 
                  type="text" 
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  placeholder="E.g. Fix login bug"
                  required
                  autoFocus
                />
              </div>

              {/* Issue Type + Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Issue Type</label>
                  <select 
                    value={newTaskType} 
                    onChange={e => setNewTaskType(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  >
                    {ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
                  <select 
                    value={newTaskPriority} 
                    onChange={e => setNewTaskPriority(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  >
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Status, Sprint and Story Points Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                  <select 
                    value={newTaskStatus} 
                    onChange={e => setNewTaskStatus(e.target.value as TaskStatus)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  >
                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Sprint</label>
                  <select 
                    value={newTaskSprintId} 
                    onChange={e => setNewTaskSprintId(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  >
                    <option value="">Backlog</option>
                    {sprints.map((s: { sprintId: string; name: string }) => <option key={s.sprintId} value={s.sprintId}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Story Points</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newTaskPoints}
                    onChange={e => setNewTaskPoints(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                    placeholder="e.g. 5"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                <textarea 
                  rows={3}
                  value={newTaskDescription}
                  onChange={e => setNewTaskDescription(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  placeholder="Describe the task..."
                />
              </div>

              {/* Labels */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Labels</label>
                <input 
                  type="text" 
                  value={newTaskLabels}
                  onChange={e => setNewTaskLabels(e.target.value)}
                  list={`label-suggestions-${key}`}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  placeholder="frontend, auth, urgent (comma separated)"
                />
                <datalist id={`label-suggestions-${key}`}>
                  {labelNames.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-medium">Cancel</button>
                <button type="submit" disabled={isCreatingTask} className="px-6 py-2 bg-white text-gray-950 hover:bg-gray-200 font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center">
                  {isCreatingTask && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Column Component ---
const KanbanColumn = ({ column, tasks, onAddClick }: { column: { id: string; title: string; color: string }, tasks: Task[], onAddClick: () => void }) => {
  return (
    <div className="flex flex-col w-80 shrink-0 bg-gray-900/50 rounded-xl border border-gray-800 max-h-full overflow-hidden" id={column.id}>
      <div className="p-4 flex items-center justify-between border-b border-gray-800/60 bg-gray-900/80 group">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${column.color}`}></div>
          <h3 className="font-semibold text-gray-200 text-sm">{column.title}</h3>
          <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onAddClick} className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="p-3 flex-1 overflow-y-auto custom-scrollbar space-y-3">
        <SortableContext items={tasks.map(t => t.taskId)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTaskCard key={task.taskId} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

// --- Sortable Card Wrapper ---
const SortableTaskCard = ({ task }: { task: Task }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.taskId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard task={task} />
    </div>
  );
};

// --- Presentational Card Component ---
const KanbanCard = ({ task, isOverlay = false }: { task: Task, isOverlay?: boolean }) => {
  const { slug, key } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const members = useBoardStore(state => state.members);

  return (
    <div 
      onClick={() => {
        if (!isOverlay && slug && key) {
          navigate(`/w/${slug}/projects/${key}/tasks/${task.taskKey}`);
        }
      }}
      className={clsx(
      "bg-gray-950 border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-600 transition-colors group relative",
      isOverlay ? "border-white/50 shadow-2xl shadow-white/10 rotate-2 scale-105" : "border-gray-800 shadow-sm"
    )}>
      {/* Priority Indicator Line */}
      <div className={clsx("absolute left-0 top-0 bottom-0 w-1 rounded-l-lg", 
        task.priority === 'critical' ? 'bg-red-500' :
        task.priority === 'high' ? 'bg-orange-500' :
        task.priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-600'
      )} />

      <div className="pl-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <IssueTypeIcon type={task.type || task.issueType || 'task'} />
            <span className="text-[11px] font-mono text-gray-500 group-hover:text-gray-400 transition-colors">
              {task.taskKey}
            </span>
            {task.storyPoints != null && (
              <span className="text-[10px] font-bold bg-purple-500/10 border border-purple-500/30 text-purple-400 px-1.5 py-0 rounded" title="Story Points">
                {task.storyPoints}
              </span>
            )}
          </div>
          {task.priority && (
            <span className={clsx(
              "w-2 h-2 rounded-full",
              task.priority === 'critical' ? 'bg-red-500' :
              task.priority === 'high' ? 'bg-orange-500' :
              task.priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-600'
            )} title={task.priority}></span>
          )}
          {!isOverlay && slug && key && (
            <button
              className="ml-auto opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 rounded-md transition-all hover:bg-red-500/10"
              onClick={async (e) => {
                e.stopPropagation();
                if (await confirm({ message: 'Are you sure you want to delete this task?', isDestructive: true })) {
                  useBoardStore.getState().deleteTask(slug, key, task.taskKey);
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        
        <p className="text-sm font-medium text-gray-200 mb-4 leading-snug line-clamp-2">
          {task.title}
        </p>

        {/* Card Footer */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {task.labels?.map((label, idx) => (
              <LabelChip key={idx} name={label} />
            ))}
          </div>

          <div className="flex items-center space-x-1">
            {/* Reporter Avatar (smaller, left side) */}
            {task.reporterId && (
              <div 
                className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[9px] text-gray-400 font-medium"
                title={`Reporter: ${members?.find(m => m.userId === task.reporterId)?.fullName || 'System'}`}
              >
                {(members?.find(m => m.userId === task.reporterId)?.fullName || 'S').charAt(0).toUpperCase()}
              </div>
            )}
            
            {/* Assignee Avatar (larger, interactive) */}
            <div className="flex items-center space-x-2 relative group/avatar">
              {task.assigneeId ? (
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-gray-600 to-gray-500 border border-gray-950 flex items-center justify-center text-[10px] text-white font-bold" title={`Assignee: ${members?.find(m => m.userId === task.assigneeId)?.fullName || 'Assigned'}`}>
                  {(members?.find(m => m.userId === task.assigneeId)?.fullName || 'U').charAt(0).toUpperCase()}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-500" title="Unassigned">
                  ?
                </div>
              )}
            {!isOverlay && slug && key && (
              <select
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                value={task.assigneeId || 'unassigned'}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  const val = e.target.value;
                  useBoardStore.getState().updateTaskAssignee(slug, key, task.taskKey, val === 'unassigned' ? null : val);
                }}
              >
                <option value="unassigned">Unassigned</option>
                {members?.map(m => (
                  <option key={m.userId} value={m.userId}>{m.fullName}</option>
                ))}
              </select>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
