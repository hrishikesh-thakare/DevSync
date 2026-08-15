import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBoardStore, Task } from '../../store/boardStore.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { apiFetch } from '../../lib/api.js';
import { Search, Loader2, MoreHorizontal, CheckSquare, Zap, BookOpen, Bug, Layers, ArrowUpDown, Calendar, Plus } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

const ISSUE_TYPES = [
  { value: 'epic', icon: Zap, color: 'text-purple-400' },
  { value: 'story', icon: BookOpen, color: 'text-blue-400' },
  { value: 'task', icon: CheckSquare, color: 'text-gray-300' },
  { value: 'bug', icon: Bug, color: 'text-red-400' },
  { value: 'subtask', icon: Layers, color: 'text-gray-500' },
];

const IssueTypeIcon = ({ type }: { type: string }) => {
  const found = ISSUE_TYPES.find(t => t.value === type);
  if (!found) {
    return (
      <span title={type} className="flex items-center justify-center">
        <CheckSquare className="w-4 h-4 text-gray-500" />
      </span>
    );
  }
  const Icon = found.icon;
  return (
    <span title={type} className="flex items-center justify-center">
      <Icon className={clsx("w-4 h-4", found.color)} />
    </span>
  );
};

export const BacklogPage = () => {
  const { slug, key } = useParams();
  const navigate = useNavigate();
  const { tasks, members, isLoading, fetchTasks, fetchMembers } = useBoardStore();
  const { isAdmin } = useCurrentWorkspaceStore();
  const currentUser = useAuthStore(state => state.user);

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
      apiFetch(`/workspaces/${slug}/projects/${key}/sprints`)
        .then(data => setSprints(data.sprints || []))
        .catch(err => console.error('Failed to load sprints', err));
    }
  }, [slug, key, fetchTasks, fetchMembers]);

  const toggleSelectAll = () => {
    if (!canEditTask) return;
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.taskId)));
    }
  };

  const toggleSelect = (e: React.ChangeEvent<HTMLInputElement>, taskId: string) => {
    e.stopPropagation();
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
      alert('Failed to apply bulk action');
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
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search backlog..." 
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-all"
            />
          </div>
          
          <button 
            onClick={() => setShowOnlyBacklog(!showOnlyBacklog)}
            className={clsx(
              "px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
              showOnlyBacklog ? "bg-white/10 border-white/20 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200"
            )}
          >
            Backlog Only
          </button>
        </div>

        <div className="flex items-center space-x-3">
          {selectedTasks.size > 0 && (
            <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700 px-3 py-1.5 animate-in fade-in slide-in-from-right-4">
              <span className="text-sm font-semibold text-white mr-3">{selectedTasks.size} selected</span>
              <select 
                value={bulkAction} 
                onChange={e => { setBulkAction(e.target.value); setBulkValue(''); }} 
                className="bg-gray-900 text-sm text-gray-300 border border-gray-700 rounded px-2 py-1 focus:outline-none mr-2"
              >
                <option value="">Select Action...</option>
                <option value="status">Change Status</option>
                <option value="priority">Change Priority</option>
                <option value="sprint">Assign Sprint</option>
              </select>
              
              {bulkAction === 'sprint' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className="bg-gray-900 text-sm text-gray-300 border border-gray-700 rounded px-2 py-1 focus:outline-none mr-2">
                  <option value="">Select Sprint...</option>
                  <option value="backlog">Backlog (Remove Sprint)</option>
                  {sprints.map((s: { sprintId: string; name: string }) => <option key={s.sprintId} value={s.sprintId}>{s.name}</option>)}
                </select>
              )}
              {bulkAction === 'status' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className="bg-gray-900 text-sm text-gray-300 border border-gray-700 rounded px-2 py-1 focus:outline-none mr-2">
                  <option value="">Select Status...</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              )}
              {bulkAction === 'priority' && (
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className="bg-gray-900 text-sm text-gray-300 border border-gray-700 rounded px-2 py-1 focus:outline-none mr-2">
                  <option value="">Select Priority...</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              )}

              <button 
                onClick={handleBulkApply} 
                disabled={isApplyingBulk || !bulkAction || !bulkValue} 
                className="text-xs bg-white text-gray-900 font-bold px-3 py-1 rounded disabled:opacity-50"
              >
                {isApplyingBulk ? <Loader2 className="w-3 h-3 animate-spin text-gray-900" /> : 'Apply'}
              </button>
            </div>
          )}

          {canEditTask && (
            <button className="flex items-center px-3 py-2 bg-white hover:bg-gray-200 text-gray-950 text-sm font-semibold rounded-lg transition-colors">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Task
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-800 bg-gray-900/80 text-xs font-semibold text-gray-500 uppercase tracking-wider shrink-0 items-center">
          <div className="col-span-2 flex items-center space-x-3">
            {canEditTask && (
              <input 
                type="checkbox" 
                checked={selectedTasks.size > 0 && selectedTasks.size === filteredTasks.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-700 bg-gray-800 focus:ring-0 cursor-pointer" 
              />
            )}
            <button onClick={() => handleSort('taskKey')} className="flex items-center hover:text-gray-300">
              Key <ArrowUpDown className="w-3 h-3 ml-1" />
            </button>
          </div>
          <div className="col-span-4">
            <button onClick={() => handleSort('title')} className="flex items-center hover:text-gray-300">
              Summary <ArrowUpDown className="w-3 h-3 ml-1" />
            </button>
          </div>
          <div className="col-span-2">
            <button onClick={() => handleSort('status')} className="flex items-center hover:text-gray-300">
              Status <ArrowUpDown className="w-3 h-3 ml-1" />
            </button>
          </div>
          <div className="col-span-1">Priority</div>
          <div className="col-span-1">Due Date</div>
          <div className="col-span-1">Assignee</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {isLoading ? (
            <div className="absolute inset-0 flex justify-center items-center">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900/30 border border-dashed border-gray-800/50 m-6 rounded-xl">
              <p>No tasks found.</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div 
                key={task.taskId} 
                onClick={() => navigate(`/w/${slug}/projects/${key}/tasks/${task.taskKey}`)}
                className={clsx(
                  "grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-800/60 hover:bg-gray-800/60 cursor-pointer transition-colors items-center group",
                  selectedTasks.has(task.taskId) && "bg-white/5 border-white/10"
                )}
              >
                {/* Checkbox & Key */}
                <div className="col-span-2 flex items-center space-x-3">
                  {canEditTask && (
                    <input 
                      type="checkbox" 
                      checked={selectedTasks.has(task.taskId)}
                      onChange={(e) => toggleSelect(e, task.taskId)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-gray-700 bg-gray-800 focus:ring-0 cursor-pointer" 
                    />
                  )}
                  <div className="flex items-center space-x-2">
                    <IssueTypeIcon type={task.type || task.issueType || 'task'} />
                    <span className="text-sm font-mono text-gray-500 group-hover:text-gray-300 transition-colors">
                      {task.taskKey}
                    </span>
                  </div>
                </div>
                
                {/* Title */}
                <div className="col-span-4 text-sm font-medium text-gray-200 truncate pr-4">
                  {task.title}
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span className={clsx(
                    "text-[10px] font-bold px-2.5 py-1 rounded-sm uppercase tracking-wide",
                    task.status === 'todo' ? "bg-gray-800 text-gray-400" :
                    task.status === 'in_progress' ? "bg-blue-500/20 text-blue-400 border border-blue-500/20" :
                    task.status === 'in_review' ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/20" :
                    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                  )}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Priority */}
                <div className="col-span-1">
                  <span className={clsx(
                    "flex items-center text-xs font-semibold capitalize",
                    task.priority === 'critical' ? 'text-red-400' :
                    task.priority === 'high' ? 'text-orange-400' :
                    task.priority === 'medium' ? 'text-yellow-400' : 'text-gray-400'
                  )}>
                    <span className={clsx("w-2 h-2 rounded-full mr-1.5", 
                      task.priority === 'critical' ? 'bg-red-500' :
                      task.priority === 'high' ? 'bg-orange-500' :
                      task.priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-500'
                    )}></span>
                    {task.priority || 'medium'}
                  </span>
                </div>

                {/* Due Date */}
                <div className="col-span-1 text-xs text-gray-500 flex items-center">
                  {task.dueDate ? (
                    <>
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      {format(new Date(task.dueDate), 'MMM d')}
                    </>
                  ) : '—'}
                </div>

                {/* Assignee */}
                <div className="col-span-1 flex items-center">
                  {task.assigneeId ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-gray-600 to-gray-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm border border-gray-900" title="Assigned">
                      U
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border border-dashed border-gray-700 flex items-center justify-center text-gray-600" title="Unassigned">
                      ?
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  <button onClick={(e) => { e.stopPropagation(); /* would open menu */ }} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
