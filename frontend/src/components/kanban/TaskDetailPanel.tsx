import React from 'react';
import { 
  X, 
  Trash2, 
  Link2, 
  Calendar, 
  UserPlus, 
  Tag, 
  CheckSquare,
  Sparkles,
  Paperclip,
  Smile,
  Layers
} from 'lucide-react';
import { Task } from '../../types';
import { users } from '../../data/users';
import { useTaskStore } from '../../store/useTaskStore';
import { useSprintStore } from '../../store/useSprintStore';
import { useEffect } from 'react';
import { useConfirm } from '../../hooks/useConfirm.js';

interface TaskDetailPanelProps {
  task: Task;
  onClose: () => void;
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({ task, onClose }) => {
  const confirm = useConfirm();
  const assignee = users.find(u => u.id === task.assigneeId);
  
  const { sprints, fetchSprints } = useSprintStore();
  
  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);
  
  const currentSprint = sprints.find(s => s.id === task.sprintId);

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg-primary/40 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      
      {/* Panel */}
      <div className="relative w-full max-w-2xl bg-bg-secondary glass-card-strong h-full flex flex-col shadow-2xl animate-slideInRight border-l border-border-default/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-default/50">
           <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-text-muted bg-bg-tertiary px-2 py-1 rounded border border-border-default/50">
                 {task.id}
              </span>
               <div className="flex items-center gap-2">
                  <button className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-bg-hover transition-colors"><Link2 size={18} /></button>
                  <button 
                    onClick={async () => {
                      if (await confirm({ message: 'Are you sure you want to delete this task?', isDestructive: true })) {
                        useTaskStore.getState().deleteTask(task.id);
                        onClose();
                      }
                    }}
                    className="text-text-muted hover:text-danger p-1 rounded-md hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
               </div>
           </div>
           <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-xl transition-all">
              <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10">
           {/* Title & Status */}
           <section>
              <div className="flex items-center gap-4 mb-4">
                 <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    task.status === 'in_progress' ? 'status-in-progress' : 
                    task.status === 'done' ? 'status-done' : 'status-todo'
                 }`}>
                    {task.status.replace('_', ' ')}
                 </div>
                 <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    task.priority === 'P0' ? 'priority-p0' : 'priority-p1'
                 }`}>
                    {task.priority}
                 </div>
              </div>
              <h2 className="text-3xl font-bold leading-tight hover:bg-bg-tertiary/20 p-2 -mx-2 rounded-lg transition-colors cursor-text">
                 {task.title}
              </h2>
           </section>

           {/* Metadata Grid */}
           <section className="grid grid-cols-2 gap-8 py-6 border-y border-border-default/30">
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <UserPlus size={16} className="text-text-muted" />
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest w-24">Assignee</span>
                    <div className="relative flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-bg-hover cursor-pointer transition-all">
                       {assignee ? (
                          <>
                            <img src={assignee.avatar} alt={assignee.fullName} className="w-6 h-6 rounded-full" />
                            <span className="text-sm font-medium">{assignee.fullName}</span>
                          </>
                       ) : (
                          <span className="text-sm font-medium text-text-muted italic">Unassigned</span>
                       )}
                       <select 
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                         value={task.assigneeId || 'unassigned'}
                         onChange={(e) => {
                           const val = e.target.value;
                           useTaskStore.getState().updateTaskAssignee(task.id, val === 'unassigned' ? null : val);
                         }}
                       >
                         <option value="unassigned">Unassigned</option>
                         {users.map(u => (
                           <option key={u.id} value={u.id}>{u.fullName}</option>
                         ))}
                       </select>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <Calendar size={16} className="text-text-muted" />
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest w-24">Due Date</span>
                    <span className="text-sm font-medium hover:text-accent-purple cursor-pointer transition-colors">Apr 24, 2026</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <Layers size={16} className="text-text-muted" />
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest w-24">Sprint</span>
                    <div className="relative flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-bg-hover cursor-pointer transition-all">
                       {currentSprint ? (
                          <span className="text-sm font-medium">{currentSprint.name}</span>
                       ) : (
                          <span className="text-sm font-medium text-text-muted italic">Backlog</span>
                       )}
                       <select 
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                         value={task.sprintId || 'backlog'}
                         onChange={(e) => {
                           const val = e.target.value;
                           useTaskStore.getState().updateTaskSprint(task.id, val === 'backlog' ? null : val);
                         }}
                       >
                         <option value="backlog">Backlog</option>
                         {sprints.map(s => (
                           <option key={s.id} value={s.id}>{s.name}</option>
                         ))}
                       </select>
                    </div>
                 </div>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <Tag size={16} className="text-text-muted" />
                    <span className="text-xs font-bold text-text-muted uppercase tracking-widest w-24">Labels</span>
                    <div className="flex flex-wrap gap-1">
                       <span className="px-2 py-0.5 rounded bg-bg-tertiary text-[10px] text-text-secondary border border-border-default">UI/UX</span>
                       <span className="px-2 py-0.5 rounded bg-bg-tertiary text-[10px] text-text-secondary border border-border-default">Product</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <Sparkles size={16} className="text-accent-purple" />
                    <span className="text-xs font-bold text-accent-purple uppercase tracking-widest w-24">AI Estimate</span>
                    <div className="flex items-center gap-1 text-sm font-bold text-accent-purple bg-accent-purple/10 px-2 py-0.5 rounded-lg">
                       {task.estimatedHours}h
                    </div>
                 </div>
              </div>
           </section>

           {/* Description */}
           <section className="space-y-4">
              <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest">Description</h3>
              <div className="glass-card bg-bg-tertiary/40 p-6 text-sm text-text-secondary leading-relaxed space-y-4">
                 <p>{task.description}</p>
                 <p>This implementation should follow the latest glassmorphism standards, focusing on backdrop blur consistency and border glow effects.</p>
              </div>
           </section>

           {/* Subtasks */}
           <section className="space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                    <CheckSquare size={16} /> Subtasks
                 </h3>
                 <span className="text-[10px] text-text-muted">2 of 3 completed</span>
              </div>
              <div className="space-y-2">
                 {[
                    { text: 'Define border-glow utility in Tailwind v4', done: true },
                    { text: 'Implement backdrop-blur for cards', done: true },
                    { text: 'Add shimmer animation for loading states', done: false }
                 ].map((sub, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 glass-card bg-bg-secondary/50 border-none group cursor-pointer hover:bg-bg-hover transition-all">
                       <div className={`w-4 h-4 rounded border ${sub.done ? 'bg-success border-success' : 'border-border-default'} flex items-center justify-center`}>
                          {sub.done && <X size={10} className="text-bg-primary stroke-[3px]" />}
                       </div>
                       <span className={`text-sm ${sub.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>{sub.text}</span>
                    </div>
                 ))}
              </div>
           </section>
        </div>

        {/* Form Input (Footer) */}
        <div className="p-6 border-t border-border-default/50">
           <div className="flex items-center gap-3 glass-input p-2 pr-4 focus-within:glass-input-focus transition-all">
              <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center text-xs font-bold shrink-0">AM</div>
              <input type="text" placeholder="Add a comment..." className="flex-1 bg-transparent border-none outline-none text-sm" />
              <div className="flex items-center gap-2 opacity-50">
                 <Paperclip size={16} />
                 <Smile size={16} className="cursor-not-allowed" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPanel;
