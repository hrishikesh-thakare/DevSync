import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBoardStore, Task } from '../../store/boardStore.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { apiFetch } from '../../lib/api.js';
import { LabelChip } from '../../components/projects/LabelChip.js';
import { useLabelStore } from '../../store/labelStore.js';
import { Search, Loader2, MoreHorizontal, CheckSquare, Zap, BookOpen, Bug, Layers, ArrowUpDown, Calendar, Plus } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ISSUE_TYPES = [
  { value: 'epic', icon: Zap, color: 'text-special' },
  { value: 'story', icon: BookOpen, color: 'text-primary' },
  { value: 'task', icon: CheckSquare, color: 'text-foreground' },
  { value: 'bug', icon: Bug, color: 'text-danger' },
  { value: 'subtask', icon: Layers, color: 'text-subtle-foreground' },
];

const IssueTypeIcon = ({ type }: { type: string }) => {
  const found = ISSUE_TYPES.find(t => t.value === type);
  if (!found) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center justify-center">
            <CheckSquare className="w-4 h-4 text-subtle-foreground" strokeWidth={1.75} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{type}</TooltipContent>
      </Tooltip>
    );
  }
  const Icon = found.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center justify-center">
          <Icon className={clsx("w-4 h-4", found.color)} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{type}</TooltipContent>
    </Tooltip>
  );
};

export const BacklogPage = () => {
  const { slug, key } = useParams();
  const navigate = useNavigate();
  const { tasks, members, isLoading, fetchTasks, fetchMembers } = useBoardStore();
  const { isAdmin } = useCurrentWorkspaceStore();
  const currentUser = useAuthStore(state => state.user);
  const fetchLabels = useLabelStore(state => state.fetchLabels);

  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyBacklog, setShowOnlyBacklog] = useState(true);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' }>({ key: 'taskKey', direction: 'desc' });

  const [sprints, setSprints] = useState<{ sprintId: string; name: string }[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);

  const myMembership = members.find(m => m.userId === currentUser?.userId);
  const canEditTask = isAdmin() || (myMembership && myMembership.role !== 'viewer');

  useEffect(() => {
    if (slug && key) {
      fetchTasks(slug, key);
      fetchMembers(slug, key);
      fetchLabels(slug, key);
      apiFetch(`/workspaces/${slug}/projects/${key}/sprints`)
        .then(data => setSprints(data.sprints || []))
        .catch(err => console.error("Couldn't load sprints. Check your connection and try again.", err));
    }
  }, [slug, key, fetchTasks, fetchMembers, fetchLabels]);

  const toggleSelectAll = () => {
    if (!canEditTask) return;
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.taskId)));
    }
  };

  const toggleSelect = (taskId: string) => {
    if (!canEditTask) return;
    const newSet = new Set(selectedTasks);
    if (newSet.has(taskId)) newSet.delete(taskId);
    else newSet.add(taskId);
    setSelectedTasks(newSet);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleBulkApply = async () => {
    if (!bulkAction || !bulkValue || selectedTasks.size === 0 || !slug || !key) return;
    setIsApplyingBulk(true);
    try {
      const promises = Array.from(selectedTasks).map(taskId => {
        const task = filteredTasks.find(t => t.taskId === taskId);
        if (!task) return Promise.resolve();
        
        const body: Record<string, unknown> = {};
        if (bulkAction === 'sprint') body.sprintId = bulkValue === 'backlog' ? null : bulkValue;
        else if (bulkAction === 'status') body.status = bulkValue;
        else if (bulkAction === 'priority') body.priority = bulkValue;
        else if (bulkAction === 'points') body.storyPoints = bulkValue !== '' ? parseInt(bulkValue) : null;
        else if (bulkAction === 'clearPoints') body.storyPoints = null;

        return apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${task.taskKey}`, {
          method: 'PATCH',
          body: JSON.stringify(body)
        });
      });

      await Promise.all(promises);
      setSelectedTasks(new Set());
      setBulkAction('');
      setBulkValue('');
      fetchTasks(slug, key);
    } catch {
      alert("Couldn't apply that change to the selected tasks. Try again in a moment.");
    } finally {
      setIsApplyingBulk(false);
    }
  };

  // Filter & Sort
  let filteredTasks = tasks;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(t => t.title.toLowerCase().includes(q) || t.taskKey.toLowerCase().includes(q));
  }
  if (showOnlyBacklog) {
    filteredTasks = filteredTasks.filter(t => !t.sprintId); // Backlog means it is not assigned to any sprint
  }

  filteredTasks.sort((a: Task, b: Task) => {
    const key = sortConfig.key as keyof Task;
    let aVal: string | number = String(a[key] || '');
    let bVal: string | number = String(b[key] || '');
    if (sortConfig.key === 'taskKey') {
      // Parse numeric part for proper sorting
      aVal = parseInt(a.taskKey.split('-')[1]) || 0;
      bVal = parseInt(b.taskKey.split('-')[1]) || 0;
    }
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="h-full flex flex-col p-6 font-sans">
      
      {/* Controls Bar */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-subtle-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
            <Input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search backlog..." 
              className="w-full bg-card pl-9 pr-4 py-2 text-ui text-foreground transition-colors"
            />
          </div>
          
          <Button 
            onClick={() => setShowOnlyBacklog(!showOnlyBacklog)}
            className={clsx(
              "px-3 py-2 text-ui font-[510] rounded-md border transition-colors",
              showOnlyBacklog ? "bg-primary-muted border-primary-border text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
            variant="secondary" size="default"
          >
            Backlog Only
          </Button>
        </div>

        <div className="flex items-center space-x-3">
          {selectedTasks.size > 0 && (
            <div className="flex items-center bg-hover rounded-md border border-border px-3 py-1.5 animate-in fade-in slide-in-from-right-4">
              <span className="text-ui font-[590] text-foreground mr-3">{selectedTasks.size} selected</span>
              <Select value={bulkAction} onValueChange={(v) => { setBulkAction(v); setBulkValue(''); }}>
                <SelectTrigger className="bg-elevated mr-2">
                  <SelectValue placeholder="Select Action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select Action...</SelectItem>
                  <SelectItem value="status">Change Status</SelectItem>
                  <SelectItem value="priority">Change Priority</SelectItem>
                  <SelectItem value="sprint">Assign Sprint</SelectItem>
                  <SelectItem value="points">Set Story Points</SelectItem>
                  <SelectItem value="clearPoints">Clear Story Points</SelectItem>
                </SelectContent>
              </Select>
              
              {bulkAction === 'sprint' && (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="bg-elevated mr-2">
                    <SelectValue placeholder="Select Sprint..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Select Sprint...</SelectItem>
                    <SelectItem value="backlog">Backlog (Remove Sprint)</SelectItem>
                    {sprints.map((s: { sprintId: string; name: string }) => <SelectItem key={s.sprintId} value={s.sprintId}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {bulkAction === 'status' && (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="bg-elevated mr-2">
                    <SelectValue placeholder="Select Status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Select Status...</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {bulkAction === 'priority' && (
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger className="bg-elevated mr-2">
                    <SelectValue placeholder="Select Priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Select Priority...</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {bulkAction === 'points' && (
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={bulkValue}
                  onChange={e => setBulkValue(e.target.value)}
                  placeholder="Points (empty = clear)"
                  className="bg-background text-ui text-foreground px-2 py-1 mr-2 w-32"
                />
              )}

              <Button 
                onClick={handleBulkApply} 
                disabled={isApplyingBulk || !bulkAction || (bulkAction !== 'clearPoints' && !bulkValue)} 
                className="text-caption font-[590] px-3 py-1 rounded-md disabled:text-disabled"
                variant="primary" size="default"
              >
                {isApplyingBulk ? <Loader2 className="w-3 h-3 animate-spin text-primary-foreground" strokeWidth={1.75} /> : 'Apply'}
              </Button>
            </div>
          )}

          {canEditTask && (
            <Button className="flex items-center px-3 py-2" variant="primary" size="default">
              <Plus className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
              Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border bg-muted text-caption font-[590] text-subtle-foreground uppercase shrink-0 items-center">
          <div className="col-span-2 flex items-center space-x-3">
            {canEditTask && (
              <Checkbox
                aria-label="Select all tasks"
                checked={filteredTasks.length > 0 && selectedTasks.size === filteredTasks.length}
                indeterminate={filteredTasks.length > 0 && selectedTasks.size > 0 && selectedTasks.size < filteredTasks.length}
                onCheckedChange={toggleSelectAll}
                className="cursor-pointer"
              />
            )}
            <Button onClick={() => handleSort('taskKey')} className="flex items-center hover:text-foreground" variant="ghost" size="default">
              Key <ArrowUpDown className="w-3 h-3 ml-1" strokeWidth={1.75} />
            </Button>
          </div>
          <div className="col-span-3">
            <Button onClick={() => handleSort('title')} className="flex items-center hover:text-foreground" variant="ghost" size="default">
              Summary <ArrowUpDown className="w-3 h-3 ml-1" strokeWidth={1.75} />
            </Button>
          </div>
          <div className="col-span-2">
            <Button onClick={() => handleSort('status')} className="flex items-center hover:text-foreground" variant="ghost" size="default">
              Status <ArrowUpDown className="w-3 h-3 ml-1" strokeWidth={1.75} />
            </Button>
          </div>
          <div className="col-span-1">
            <Button onClick={() => handleSort('storyPoints')} className="flex items-center hover:text-foreground" variant="ghost" size="default">
              Points <ArrowUpDown className="w-3 h-3 ml-1" strokeWidth={1.75} />
            </Button>
          </div>
          <div className="col-span-1">Priority</div>
          <div className="col-span-1">Due Date</div>
          <div className="col-span-1">Assignee</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto relative">
          {isLoading ? (
            <div className="absolute inset-0 flex justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" strokeWidth={1.5} />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-subtle-foreground bg-card border border-dashed border-border m-6 rounded-lg">
              <p>No tasks found.</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div 
                key={task.taskId} 
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/w/${slug}/projects/${key}/tasks/${task.taskKey}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/w/${slug}/projects/${key}/tasks/${task.taskKey}`);
                  }
                }}
                className={clsx(
                  "grid grid-cols-12 gap-4 px-6 py-3 border-b border-border hover:bg-hover cursor-pointer transition-colors items-center group focus-visible:ring-2 focus-visible:ring-ring",
                  selectedTasks.has(task.taskId) && "bg-hover border-strong"
                )}
              >
                {/* Checkbox & Key */}
                <div className="col-span-2 flex items-center space-x-3">
                  {canEditTask && (
                    <Checkbox
                      aria-label={`Select ${task.taskKey}`}
                      checked={selectedTasks.has(task.taskId)}
                      onCheckedChange={() => toggleSelect(task.taskId)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer"
                    />
                  )}
                  <div className="flex items-center space-x-2">
                    <IssueTypeIcon type={task.type || task.issueType || 'task'} />
                    <span className="text-ui font-mono text-subtle-foreground group-hover:text-primary transition-colors">
                      {task.taskKey}
                    </span>
                  </div>
                </div>
                
                {/* Title */}
                <div className="col-span-3 text-ui font-[510] text-foreground truncate pr-4">
                  {task.title}
                  {task.labels && task.labels.length > 0 && (
                    <span className="flex flex-wrap gap-1 mt-1">
                      {task.labels.map((label, idx) => (
                        <LabelChip key={idx} name={label} />
                      ))}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span className={clsx(
                    "text-micro font-[590] px-2.5 py-1 rounded-sm uppercase tracking-wide",
                    task.status === 'todo' ? "bg-muted text-muted-foreground" :
                    task.status === 'in_progress' ? "bg-primary-muted text-primary-on-muted border border-primary-border" :
                    task.status === 'in_review' ? "bg-warning-muted text-warning border border-warning-border" :
                    "bg-success-muted text-success border border-success-border"
                  )}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Story Points */}
                <div className="col-span-1">
                  {task.storyPoints != null ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="bg-primary-muted text-primary-on-muted border-primary-border font-[590]">
                          {task.storyPoints}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>Story Points</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-caption text-subtle-foreground">—</span>
                  )}
                </div>

                {/* Priority */}
                <div className="col-span-1">
                  <span className={clsx(
                    "flex items-center text-caption font-[590] capitalize",
                    task.priority === 'critical' ? 'text-danger' :
                    task.priority === 'high' ? 'text-warning' :
                    task.priority === 'medium' ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    <span className={clsx("w-2 h-2 rounded-full mr-1.5",
                      task.priority === 'critical' ? 'bg-danger' :
                      task.priority === 'high' ? 'bg-warning' :
                      task.priority === 'medium' ? 'bg-primary' : 'bg-subtle-foreground'
                    )}></span>
                    {task.priority || 'medium'}
                  </span>
                </div>

                {/* Due Date */}
                <div className="col-span-1 text-caption text-subtle-foreground flex items-center">
                  {task.dueDate ? (
                    <>
                      <Calendar className="w-4 h-4 mr-1" strokeWidth={1.75} />
                      {format(new Date(task.dueDate), 'MMM d')}
                    </>
                  ) : '—'}
                </div>

                {/* Assignee */}
                <div className="col-span-1 flex items-center">
                  {task.assigneeId ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar size="sm" className="border border-border shadow-sm">
                          <AvatarFallback className="bg-hover text-micro font-[590] text-foreground">
                            U
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>Assigned</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar size="sm">
                          <AvatarFallback className="border border-dashed border-border text-subtle-foreground bg-transparent" />
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>Unassigned</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  <Button onClick={(e) => { e.stopPropagation(); /* would open menu */ }} className="p-1.5 text-subtle-foreground hover:text-foreground hover:bg-hover rounded-md transition-colors opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100" size="icon" variant="ghost">
                    <MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
