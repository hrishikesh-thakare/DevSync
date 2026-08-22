import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBoardStore, Task, TaskStatus } from '../../store/boardStore.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { Loader2, AlertCircle, Plus, Bug, BookOpen, Zap, CheckSquare, Layers, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../store/auth.js';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { LabelChip } from '../../components/projects/LabelChip.js';
import { useLabelStore } from '../../store/labelStore.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  { id: 'todo', title: 'To Do', color: 'bg-subtle-foreground' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-primary' },
  { id: 'in_review', title: 'In Review', color: 'bg-warning' },
  { id: 'done', title: 'Done', color: 'bg-success' },
];

const ISSUE_TYPES = [
  { value: 'epic', label: 'Epic', icon: Zap, color: 'text-special' },
  { value: 'story', label: 'Story', icon: BookOpen, color: 'text-primary' },
  { value: 'task', label: 'Task', icon: CheckSquare, color: 'text-foreground' },
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-danger' },
  { value: 'subtask', label: 'Subtask', icon: Layers, color: 'text-subtle-foreground' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-danger' },
  { value: 'high', label: 'High', color: 'bg-warning' },
  { value: 'medium', label: 'Medium', color: 'bg-primary' },
  { value: 'low', label: 'Low', color: 'bg-subtle-foreground' },
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
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
        <Button 
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(
            "flex items-center text-sm px-3 py-1.5 rounded-md border transition-colors h-auto",
            hasActiveFilters ? "border-primary-border text-primary bg-primary-muted" : "border-border text-muted-foreground hover:text-foreground bg-card"
          )}
          variant="outline" size="default"
        >
          <AlertCircle className="w-3.5 h-3.5 mr-2" />
          Filters
          {hasActiveFilters && <span className="ml-2 w-1.5 h-1.5 bg-primary rounded-full"></span>}
        </Button>

        {showFilters && (
          <>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="bg-elevated">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="bg-elevated">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ISSUE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button 
                onClick={() => { setFilterPriority('all'); setFilterType('all'); }}
                className="text-xs text-subtle-foreground hover:text-foreground transition-colors"
                variant="ghost" size="default"
              >
                Clear
              </Button>
            )}
          </>
        )}

        <div className="flex-1" />
        <div className="flex items-center space-x-3">
          {canEditTask && (
            <Button 
              onClick={() => { setNewTaskStatus('todo'); setShowTaskModal(true); }}
              className="flex items-center px-3 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold rounded-md transition-colors"
              variant="default" size="default"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Task
            </Button>
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
        <Dialog open onOpenChange={(open) => { if (!open) setShowTaskModal(false); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
              <DialogDescription>Add a new task to this project.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTask} className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="task-title">Title *</Label>
                <Input
                  id="task-title"
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="E.g. Fix login bug"
                  required
                  autoFocus
                />
              </div>

              {/* Issue Type + Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="task-type">Issue Type</Label>
                  <Select value={newTaskType} onValueChange={setNewTaskType}>
                    <SelectTrigger id="task-type" className="w-full bg-elevated">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-priority">Priority</Label>
                  <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                    <SelectTrigger id="task-priority" className="w-full bg-elevated">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status, Sprint and Story Points Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="task-status">Status</Label>
                  <Select value={newTaskStatus} onValueChange={(v) => setNewTaskStatus(v as TaskStatus)}>
                    <SelectTrigger id="task-status" className="w-full bg-elevated">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-sprint">Sprint</Label>
                  <Select value={newTaskSprintId} onValueChange={setNewTaskSprintId}>
                    <SelectTrigger id="task-sprint" className="w-full bg-elevated">
                      <SelectValue placeholder="Backlog" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Backlog</SelectItem>
                      {sprints.map((s: { sprintId: string; name: string }) => <SelectItem key={s.sprintId} value={s.sprintId}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-points">Story Points</Label>
                  <Input
                    id="task-points"
                    type="number"
                    min="0"
                    max="100"
                    value={newTaskPoints}
                    onChange={e => setNewTaskPoints(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  rows={3}
                  value={newTaskDescription}
                  onChange={e => setNewTaskDescription(e.target.value)}
                  placeholder="Describe the task..."
                />
              </div>

              {/* Labels */}
              <div className="space-y-2">
                <Label htmlFor="task-labels">Labels</Label>
                <Input
                  id="task-labels"
                  type="text"
                  value={newTaskLabels}
                  onChange={e => setNewTaskLabels(e.target.value)}
                  list={`label-suggestions-${key}`}
                  placeholder="frontend, auth, urgent (comma separated)"
                />
                <datalist id={`label-suggestions-${key}`}>
                  {labelNames.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => setShowTaskModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isCreatingTask}>
                  {isCreatingTask && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Task
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// --- Column Component ---
const KanbanColumn = ({ column, tasks, onAddClick }: { column: { id: string; title: string; color: string }, tasks: Task[], onAddClick: () => void }) => {
  return (
    <div className="flex flex-col w-80 shrink-0 bg-muted rounded-lg border border-border max-h-full overflow-hidden" id={column.id}>
      <div className="p-4 flex items-center justify-between border-b border-border group">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${column.color}`}></div>
          <h3 className="font-semibold text-foreground text-sm">{column.title}</h3>
          <span className="bg-card text-muted-foreground text-xs px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button onClick={onAddClick} className="p-1 text-subtle-foreground hover:text-foreground hover:bg-hover rounded-md" size="icon" variant="ghost"><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-3">
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
      "bg-card border rounded-md p-3 cursor-grab active:cursor-grabbing hover:border-border-strong transition-colors group relative",
      isOverlay ? "border-primary shadow-md rotate-2 scale-105" : "border-border shadow-sm"
    )}>
      {/* Priority Indicator Line */}
      <div className={clsx("absolute left-0 top-0 bottom-0 w-1 rounded-l-md",
        task.priority === 'critical' ? 'bg-danger' :
        task.priority === 'high' ? 'bg-warning' :
        task.priority === 'medium' ? 'bg-primary' : 'bg-border-strong'
      )} />

      <div className="pl-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <IssueTypeIcon type={task.type || task.issueType || 'task'} />
            <span className="text-[11px] font-mono text-subtle-foreground group-hover:text-muted-foreground transition-colors">
              {task.taskKey}
            </span>
            {task.storyPoints != null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-primary-muted text-primary border-primary-border text-[10px] h-auto px-1.5 font-bold">
                    {task.storyPoints}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Story Points</TooltipContent>
              </Tooltip>
            )}
          </div>
          {task.priority && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={clsx(
                  "w-2 h-2 rounded-full",
                  task.priority === 'critical' ? 'bg-danger' :
                  task.priority === 'high' ? 'bg-warning' :
                  task.priority === 'medium' ? 'bg-primary' : 'bg-subtle-foreground'
                )}></span>
              </TooltipTrigger>
              <TooltipContent>{task.priority}</TooltipContent>
            </Tooltip>
          )}
          {!isOverlay && slug && key && (
            <Button
              className="ml-auto opacity-0 group-hover:opacity-100 text-subtle-foreground hover:text-danger p-1 rounded-md transition-all hover:bg-danger-muted"
              onClick={async (e) => {
                e.stopPropagation();
                if (await confirm({ message: 'Are you sure you want to delete this task?', isDestructive: true })) {
                  useBoardStore.getState().deleteTask(slug, key, task.taskKey);
                }
              }}
              size="icon" variant="destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        
        <p className="text-sm font-medium text-foreground mb-4 leading-snug line-clamp-2">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar size="sm" className="size-5 border border-border">
                    <AvatarFallback className="bg-secondary text-[9px] text-muted-foreground font-medium">
                      {(members?.find(m => m.userId === task.reporterId)?.fullName || 'S').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{`Reporter: ${members?.find(m => m.userId === task.reporterId)?.fullName || 'System'}`}</TooltipContent>
              </Tooltip>
            )}
            
            {/* Assignee Avatar (larger, interactive) */}
            <div className="flex items-center space-x-2 relative group/avatar">
              {task.assigneeId ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar size="sm" className="border border-border">
                      <AvatarFallback className="bg-secondary text-[10px] text-foreground font-bold">
                        {(members?.find(m => m.userId === task.assigneeId)?.fullName || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>{`Assignee: ${members?.find(m => m.userId === task.assigneeId)?.fullName || 'Assigned'}`}</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar size="sm" className="border border-border">
                      <AvatarFallback className="bg-secondary text-subtle-foreground" />
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>Unassigned</TooltipContent>
                </Tooltip>
              )}
            {!isOverlay && slug && key && (
              <Select
                value={task.assigneeId || 'unassigned'}
                onValueChange={(val) => {
                  useBoardStore.getState().updateTaskAssignee(slug, key, task.taskKey, val === 'unassigned' ? null : val);
                }}
              >
                <SelectTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members?.map(m => (
                    <SelectItem key={m.userId} value={m.userId}>{m.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
