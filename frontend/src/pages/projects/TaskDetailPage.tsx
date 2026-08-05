import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { Loader2, ArrowLeft, AlignLeft, Trash2, X, GitCommit } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useAuthStore } from '../../store/auth.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { MessageSquare, GitPullRequest, AlertCircle, GitBranch, PlayCircle, ExternalLink } from 'lucide-react';
import { CreateBranchModal } from './github/CreateBranchModal.js';

const STATUSES = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const ISSUE_TYPES = [
  { value: 'epic', label: 'Epic' },
  { value: 'story', label: 'Story' },
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'subtask', label: 'Subtask' },
];

export const TaskDetailPage = () => {
  const { slug, key, taskKey } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);

  // Auth and permissions
  const currentUser = useAuthStore(state => state.user);
  const { isAdmin } = useCurrentWorkspaceStore();
  const myMembership = members.find(m => m.userId === currentUser?.userId);
  const canEditTask = isAdmin() || (myMembership && myMembership.role !== 'viewer');

  // Editable states
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // New feature states
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [githubActivity, setGithubActivity] = useState<{
    commits: any[];
    pullRequests: any[];
    issues: any[];
    branches: any[];
  }>({ commits: [], pullRequests: [], issues: [], branches: [] });
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const { channels } = useCurrentWorkspaceStore();

  const fetchGithubActivity = async () => {
    try {
      const cRes = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}/github-activity`);
      setGithubActivity(cRes.activity || { commits: [], pullRequests: [], issues: [], branches: [] });
    } catch (e) {}
  };

  useEffect(() => {
    const fetchTask = async () => {
      setIsLoading(true);
      try {
        const [taskData, membersData, sprintsData, allTasksData] = await Promise.all([
          apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}`),
          apiFetch(`/workspaces/${slug}/projects/${key}/members`),
          apiFetch(`/workspaces/${slug}/projects/${key}/sprints`),
          apiFetch(`/workspaces/${slug}/projects/${key}/tasks`),
        ]);

        let commitsData = [];
        try {
          const cRes = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}/github-activity`);
          setGithubActivity(cRes.activity || { commits: [], pullRequests: [], issues: [], branches: [] });
        } catch (e) {}
        setTask(taskData.task);
        setEditTitle(taskData.task.title);
        const descVal = typeof taskData.task.description === 'string' ? taskData.task.description : taskData.task.descriptionText || '';
        setEditDesc(descVal);
        setMembers(membersData.members || []);
        setSprints(sprintsData.sprints || []);
        setAllTasks(allTasksData.tasks || []);
      } catch (err) {
        console.error('Failed to load task', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (slug && key && taskKey) fetchTask();
  }, [slug, key, taskKey]);

  const patchTask = async (fields: Record<string, any>) => {
    if (!canEditTask) return;
    setIsSaving(true);
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}`, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      setTask((prev: any) => ({ ...prev, ...fields }));
    } catch (err: any) {
      alert(err.message || 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!canEditTask) return;
    if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return;
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}`, { method: 'DELETE' });
      navigate(`/w/${slug}/projects/${key}`);
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const handleTitleSave = () => {
    if (!canEditTask) return;
    if (editTitle.trim() && editTitle !== task.title) {
      patchTask({ title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleDescSave = () => {
    if (!canEditTask) return;
    if (editDesc !== (task.description || '')) {
      patchTask({ description: editDesc });
    }
    setIsEditingDesc(false);
  };

  const addLabel = () => {
    if (!canEditTask) return;
    if (!labelInput.trim()) return;
    const currentLabels = task.labels || [];
    if (!currentLabels.includes(labelInput.trim())) {
      const newLabels = [...currentLabels, labelInput.trim()];
      patchTask({ labels: newLabels });
    }
    setLabelInput('');
  };

  const removeLabel = (label: string) => {
    if (!canEditTask) return;
    const newLabels = (task.labels || []).filter((l: string) => l !== label);
    patchTask({ labels: newLabels });
  };

  const handleDiscussInChannel = () => {
    // Find a channel for this project
    const projectChannel = channels.find(c => c.projectId === task?.projectId) || channels.find(c => !c.projectId && c.type !== 'dm' && c.type !== 'group_dm');
    if (projectChannel) {
      navigate(`/w/${slug}/channels/${projectChannel.channelId}?task=${taskKey}`);
    } else {
      alert("No channel found to discuss this task.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-8 text-center text-gray-500">
        <h2 className="text-xl font-bold text-white mb-2">Task not found</h2>
        <button onClick={() => navigate(-1)} className="text-gray-300 hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-gray-950 font-sans">
      
      {/* Top Breadcrumb & Actions */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-mono text-gray-400 bg-gray-900 px-2 py-1 rounded border border-gray-800">{task.taskKey}</span>
          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
        </div>
        <div className="flex items-center space-x-3">
          {canEditTask && (
            <button 
              onClick={handleDeleteTask}
              className="text-sm font-medium px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={handleDiscussInChannel}
            className="text-sm font-medium px-3 py-1.5 bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors flex items-center"
          >
            <MessageSquare className="w-4 h-4 mr-1.5" /> Discuss
          </button>
          <button
            onClick={() => setShowCreateBranch(true)}
            className="text-sm font-medium px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-500 rounded transition-colors flex items-center"
          >
            <PlayCircle className="w-4 h-4 mr-1.5" /> Start Work
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 grid grid-cols-12 gap-8">
        
        {/* Main Left Content */}
        <div className="col-span-8 space-y-8">
          {/* Title Area — Click to edit */}
          <div>
            {isEditingTitle ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setIsEditingTitle(false); }}
                  className="text-3xl font-bold text-gray-100 bg-transparent border-b-2 border-white/50 focus:outline-none flex-1"
                  autoFocus
                />
                <button onClick={handleTitleSave} className="text-sm text-white bg-white/20 px-3 py-1 rounded">Save</button>
                <button onClick={() => setIsEditingTitle(false)} className="text-sm text-gray-400 hover:text-white">Cancel</button>
              </div>
            ) : (
              <h1 
                className={clsx("text-3xl font-bold text-gray-100 mb-4 leading-snug transition-colors", canEditTask && "cursor-pointer hover:text-white")}
                onClick={() => canEditTask && setIsEditingTitle(true)}
                title={canEditTask ? "Click to edit title" : undefined}
              >
                {task.title}
              </h1>
            )}
          </div>

          {/* Description — Click to edit */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-gray-300 font-semibold">
                <AlignLeft className="w-5 h-5" />
                <h3>Description</h3>
              </div>
              {canEditTask && !isEditingDesc && (
                <button onClick={() => setIsEditingDesc(true)} className="text-xs text-gray-500 hover:text-white transition-colors">
                  Edit
                </button>
              )}
            </div>
            {isEditingDesc ? (
              <div className="space-y-2">
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={6}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-gray-300 text-sm leading-relaxed focus:outline-none focus:border-white/50"
                  autoFocus
                />
                <div className="flex space-x-2">
                  <button onClick={handleDescSave} className="text-sm bg-white text-gray-950 px-4 py-1.5 rounded-lg font-bold hover:bg-gray-200">Save</button>
                  <button onClick={() => { setIsEditingDesc(false); setEditDesc(typeof task.description === 'string' ? task.description : task.descriptionText || ''); }} className="text-sm text-gray-400 hover:text-white">Cancel</button>
                </div>
              </div>
            ) : (
              <div 
                className={clsx("bg-gray-900/50 border border-gray-800 rounded-xl p-4 min-h-[100px] transition-colors", canEditTask && "cursor-pointer hover:border-gray-700")}
                onClick={() => canEditTask && setIsEditingDesc(true)}
              >
                <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">
                  {(typeof task.description === 'string' && task.description) || task.descriptionText || (canEditTask ? 'Click to add a description...' : 'No description provided.')}
                </p>
              </div>
            )}
          </div>

          {/* Discussion */}
          <div>
            <div className="flex items-center space-x-2 text-gray-300 font-semibold mb-4 border-b border-gray-800 pb-2">
              <MessageSquare className="w-5 h-5" />
              <h3>Discussion</h3>
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-400 mb-4 text-sm">Task discussions have been moved to project channels for better team visibility.</p>
              <button 
                onClick={handleDiscussInChannel}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Discuss in Channel
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar Details */}
        <div className="col-span-4 space-y-6">
          <div className="bg-gray-900/40 border border-gray-800/80 rounded-xl p-5 space-y-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Details</h4>
            
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <select
                  value={task.status}
                  onChange={e => patchTask({ status: e.target.value })}
                  disabled={!canEditTask}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-sm font-semibold focus:outline-none disabled:opacity-50"
                >
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Issue Type */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Type</span>
                <select
                  value={task.type || 'task'}
                  onChange={e => patchTask({ type: e.target.value })}
                  disabled={!canEditTask}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-sm focus:outline-none disabled:opacity-50"
                >
                  {ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Priority</span>
                <select
                  value={task.priority}
                  onChange={e => patchTask({ priority: e.target.value })}
                  disabled={!canEditTask}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-sm focus:outline-none disabled:opacity-50"
                >
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Assignee</span>
                <select
                  value={task.assigneeId || ''}
                  onChange={e => patchTask({ assigneeId: e.target.value || null })}
                  disabled={!canEditTask}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-sm focus:outline-none max-w-[160px] disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  {members.map((m: any) => (
                    <option key={m.userId} value={m.userId}>{m.fullName}</option>
                  ))}
                </select>
              </div>

              {/* Reporter */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Reporter</span>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] text-gray-300 font-bold">
                    {(members.find(m => m.userId === task.reporterId)?.fullName || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-300 font-medium">
                    {members.find(m => m.userId === task.reporterId)?.fullName || 'System'}
                  </span>
                </div>
              </div>

              {/* Due Date */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Due Date</span>
                <input
                  type="date"
                  value={task.dueDate ? task.dueDate.substring(0, 10) : ''}
                  onChange={e => patchTask({ dueDate: e.target.value || null })}
                  disabled={!canEditTask}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-sm focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Sprint */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Sprint</span>
                <select
                  value={task.sprintId || ''}
                  onChange={e => patchTask({ sprintId: e.target.value || null })}
                  disabled={!canEditTask}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-sm focus:outline-none max-w-[160px] disabled:opacity-50"
                >
                  <option value="">Backlog</option>
                  {sprints.map((s: any) => (
                    <option key={s.sprintId} value={s.sprintId}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Parent Task */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Parent Task</span>
                <select
                  value={task.parentTaskId || ''}
                  onChange={e => patchTask({ parentTaskId: e.target.value || null })}
                  disabled={!canEditTask}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-sm focus:outline-none max-w-[160px] disabled:opacity-50"
                >
                  <option value="">None</option>
                  {allTasks.filter(t => t.taskId !== task.taskId).map((t: any) => (
                    <option key={t.taskId} value={t.taskId}>{t.taskKey} - {t.title.substring(0, 20)}...</option>
                  ))}
                </select>
              </div>

              {/* Points */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Points</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={task.points || ''}
                  onChange={e => patchTask({ points: e.target.value ? parseInt(e.target.value) : null })}
                  disabled={!canEditTask}
                  className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-sm focus:outline-none w-16 text-right disabled:opacity-50"
                  placeholder="—"
                />
              </div>

              {/* Labels */}
              <div>
                <span className="text-sm text-gray-500 block mb-2">Labels</span>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(task.labels || []).map((label: string, idx: number) => (
                    <span key={idx} className="flex items-center bg-white/10 border border-white/20 text-gray-300 text-xs px-2 py-0.5 rounded">
                      {label}
                      {canEditTask && (
                        <button onClick={() => removeLabel(label)} className="ml-1.5 text-gray-500 hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {canEditTask && (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={labelInput}
                      onChange={e => setLabelInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLabel(); } }}
                      className="flex-1 bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 text-xs focus:outline-none"
                      placeholder="Add label..."
                    />
                    <button onClick={addLabel} className="text-xs text-gray-400 hover:text-white">Add</button>
                  </div>
                )}
              </div>

              {/* GitHub Activity Sidebar Section */}
              <div className="pt-4 border-t border-gray-800/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <GitBranch className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300 font-semibold">GitHub Activity</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Pull Requests */}
                  {githubActivity.pullRequests?.length > 0 && (
                    <div>
                      <div className="flex items-center text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
                        <GitPullRequest className="w-3 h-3 mr-1" /> Pull Requests
                      </div>
                      <div className="space-y-1.5">
                        {githubActivity.pullRequests.map(pr => (
                          <a key={pr.id} href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" className="block bg-gray-900 border border-gray-800 rounded p-2 hover:border-gray-600 transition-colors">
                            <div className="flex items-start justify-between">
                              <span className="text-xs text-gray-300 font-medium line-clamp-2 pr-2">{pr.title}</span>
                              {pr.state === 'open' && <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded flex-shrink-0">Open</span>}
                              {pr.state === 'merged' && <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded flex-shrink-0">Merged</span>}
                              {pr.state === 'closed' && <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded flex-shrink-0">Closed</span>}
                            </div>
                            <div className="text-[10px] font-mono text-gray-500 mt-1">#{pr.prNumber}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Branches */}
                  {githubActivity.branches?.length > 0 && (
                    <div>
                      <div className="flex items-center text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
                        <GitBranch className="w-3 h-3 mr-1" /> Branches
                      </div>
                      <div className="space-y-1.5">
                        {githubActivity.branches.map(b => (
                          <div key={b.id} className="flex flex-col bg-gray-900 border border-gray-800 rounded p-2">
                            <div className="flex items-start justify-between">
                              <span className="text-xs font-mono text-blue-400 break-all">{b.branchName}</span>
                              {b.isDeleted && <span className="text-[10px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">Deleted</span>}
                            </div>
                            {b.htmlUrl && !b.isDeleted && (
                              <a href={b.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-500 hover:text-white mt-1 flex items-center">
                                View on GitHub <ExternalLink className="w-3 h-3 ml-1" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Issues */}
                  {githubActivity.issues?.length > 0 && (
                    <div>
                      <div className="flex items-center text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
                        <AlertCircle className="w-3 h-3 mr-1" /> Issues
                      </div>
                      <div className="space-y-1.5">
                        {githubActivity.issues.map(issue => (
                          <a key={issue.id} href={issue.htmlUrl} target="_blank" rel="noopener noreferrer" className="block bg-gray-900 border border-gray-800 rounded p-2 hover:border-gray-600 transition-colors">
                            <div className="flex items-start justify-between">
                              <span className="text-xs text-gray-300 font-medium line-clamp-2 pr-2">{issue.title}</span>
                              {issue.state === 'open' ? <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded flex-shrink-0">Open</span> : <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded flex-shrink-0">Closed</span>}
                            </div>
                            <div className="text-[10px] font-mono text-gray-500 mt-1">#{issue.githubIssueNumber}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Commits */}
                  {githubActivity.commits?.length > 0 && (
                    <div>
                      <div className="flex items-center text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wider">
                        <GitCommit className="w-3 h-3 mr-1" /> Commits
                      </div>
                      <div className="space-y-1.5">
                        {githubActivity.commits.map(c => (
                          <a key={c.commitSha} href={c.url} target="_blank" rel="noopener noreferrer" className="block bg-gray-900 border border-gray-800 rounded p-2 hover:border-gray-600 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-xs text-blue-400">{c.commitSha.substring(0, 7)}</span>
                              <span className="text-[10px] text-gray-500">{format(new Date(c.committedAt), 'MMM d')}</span>
                            </div>
                            <p className="text-xs text-gray-300 truncate" title={c.messageHeadline}>{c.messageHeadline}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {githubActivity.commits.length === 0 && githubActivity.pullRequests.length === 0 && githubActivity.issues.length === 0 && githubActivity.branches.length === 0 && (
                    <div className="text-center py-4 bg-gray-900/40 border border-gray-800/80 rounded-lg">
                      <p className="text-xs text-gray-400 mb-2 font-medium">No GitHub activity yet</p>
                      <p className="text-[10px] text-gray-500 max-w-[200px] mx-auto leading-relaxed">
                        Mention <span className="font-mono text-gray-300 bg-gray-800 px-1 rounded">{taskKey}</span> in branches, PRs, issues or commits.
                      </p>
                    </div>
                  )}
                </div>
              </div>


              {/* Created / Updated */}
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Created</span>
                  <span className="text-gray-500">{task.createdAt ? format(new Date(task.createdAt), 'MMM d, yyyy') : '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Updated</span>
                  <span className="text-gray-500">{task.updatedAt ? format(new Date(task.updatedAt), 'MMM d, yyyy') : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      {showCreateBranch && (
        <CreateBranchModal
          slug={slug as string}
          keyStr={key as string}
          initialTaskId={task.taskId}
          onClose={() => setShowCreateBranch(false)}
          onCreated={() => {
            setShowCreateBranch(false);
            fetchGithubActivity();
          }}
        />
      )}
    </div>
  );
};
