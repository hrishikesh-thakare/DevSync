import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { Loader2, ArrowLeft, AlignLeft, Trash2, X, GitCommit, Paperclip, Download, File, FileImage, FileText, FileCode2, FileVideo2, FileAudio2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import clsx from 'clsx';
import { useAuthStore } from '../../store/auth.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { MessageSquare, GitPullRequest, AlertCircle, GitBranch, ExternalLink, Plus, Copy, Check } from 'lucide-react';
import { CreatePRModal } from './github/CreatePRModal.js';
import { TaskComments } from './TaskComments.js';
import { LabelChip } from '../../components/projects/LabelChip.js';
import { useLabelStore } from '../../store/labelStore.js';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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

const STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
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

interface ProjectMember {
  userId: string;
  fullName: string;
  role: string;
  avatarUrl?: string;
}

interface SprintItem {
  sprintId: string;
  name: string;
}

interface TaskAttachment {
  fileId: string;
  filename: string;
  mimetype?: string | null;
  sizeBytes?: number | null;
  filetype?: string | null;
  createdAt?: string;
  uploaderId?: string | null;
  uploaderName?: string | null;
  uploaderAvatar?: string | null;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const attachmentIcon = (filetype?: string | null) => {
  switch (filetype) {
    case 'image': return <FileImage className="w-4 h-4 text-special flex-shrink-0" strokeWidth={1.75} />;
    case 'pdf': return <FileText className="w-4 h-4 text-danger-on-muted flex-shrink-0" strokeWidth={1.75} />;
    case 'code': return <FileCode2 className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={1.75} />;
    case 'video': return <FileVideo2 className="w-4 h-4 text-success flex-shrink-0" strokeWidth={1.75} />;
    case 'audio': return <FileAudio2 className="w-4 h-4 text-warning flex-shrink-0" strokeWidth={1.75} />;
    default: return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />;
  }
};

interface TaskItem {
  taskId: string;
  taskKey: string;
  projectId: string;
  title: string;
  description?: string;
  descriptionText?: string;
  status: string;
  type?: string;
  priority: string;
  assigneeId?: string | null;
  reporterId?: string | null;
  sprintId?: string | null;
  parentTaskId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  labels?: string[];
  aiDurationEstimate?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface GithubActivityCommit {
  commitSha: string;
  messageHeadline: string;
  authorName?: string;
  committedAt: string;
  url?: string;
}

interface GithubActivityPR {
  id: string;
  prNumber: number;
  title: string;
  state: string;
  htmlUrl?: string;
  headBranch?: string;
  baseBranch?: string;
}

interface GithubActivityIssue {
  id: string;
  githubIssueNumber: number;
  title: string;
  state: string;
  htmlUrl?: string;
}

interface GithubActivityBranch {
  id: string;
  branchName: string;
  isDeleted?: boolean;
  htmlUrl?: string;
}

export const TaskDetailPage = () => {
  const { slug, key, taskKey } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [sprints, setSprints] = useState<SprintItem[]>([]);

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

  const labels = useLabelStore(state => state.labels);
  const fetchLabels = useLabelStore(state => state.fetchLabels);
  const labelNames = labels.map(l => l.name);

  // New feature states
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [githubActivity, setGithubActivity] = useState<{
    commits: GithubActivityCommit[];
    pullRequests: GithubActivityPR[];
    issues: GithubActivityIssue[];
    branches: GithubActivityBranch[];
  }>({ commits: [], pullRequests: [], issues: [], branches: [] });
  const [showCreatePR, setShowCreatePR] = useState(false);
  const [copiedBranch, setCopiedBranch] = useState(false);
  const { channels } = useCurrentWorkspaceStore();
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    try {
      const data = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}/attachments`);
      setAttachments(data.attachments || []);
    } catch (err: unknown) {
      console.debug('Failed to fetch task attachments:', err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canEditTask) return;

    setIsUploading(true);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          mimetype: file.type,
          sizeBytes: file.size,
          filetype: file.type.startsWith('image/') ? 'image' :
                   file.type.startsWith('video/') ? 'video' :
                   file.type === 'application/pdf' ? 'pdf' : 'other',
          fileBase64,
        }),
      });
      await fetchAttachments();
    } catch (err: unknown) {
      console.error('Failed to upload attachment:', err);
      toast.error("Couldn't upload attachment. Try again in a moment.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      const data = await apiFetch(`/workspaces/${slug}/files/${fileId}/download`);
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    } catch (err: unknown) {
      console.error('Failed to get attachment download URL:', err);
      toast.error("Couldn't download attachment. Try again in a moment.");
    }
  };

  const handleDeleteAttachment = async (fileId: string) => {
    if (!(await confirm({ message: 'Remove this attachment? The file will be deleted from the task.', isDestructive: true }))) return;
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}/attachments/${fileId}`, {
        method: 'DELETE',
      });
      setAttachments(prev => prev.filter(a => a.fileId !== fileId));
    } catch (err: unknown) {
      console.error('Failed to remove attachment:', err);
      toast.error("Couldn't remove attachment. Try again in a moment.");
    }
  };

  const fetchGithubActivity = async () => {
    try {
      const cRes = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}/github/github-activity`);
      setGithubActivity({
        commits: cRes.commits || [],
        pullRequests: cRes.pullRequests || [],
        issues: cRes.issues || [],
        branches: cRes.branches || []
      });
    } catch (err: unknown) {
      console.debug('Failed to fetch GitHub activity:', err);
    }
  };

  useEffect(() => {
    const fetchTask = async () => {
      setIsLoading(true);
      try {
        fetchLabels(slug || '', key || '');
        const [taskData, membersData, sprintsData, allTasksData, attachmentsData] = await Promise.all([
          apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}`),
          apiFetch(`/workspaces/${slug}/projects/${key}/members`),
          apiFetch(`/workspaces/${slug}/projects/${key}/sprints`),
          apiFetch(`/workspaces/${slug}/projects/${key}/tasks`),
          apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}/attachments`),
        ]);

        try {
          const cRes = await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}/github/github-activity`);
          setGithubActivity({
            commits: cRes.commits || [],
            pullRequests: cRes.pullRequests || [],
            issues: cRes.issues || [],
            branches: cRes.branches || []
          });
        } catch (err: unknown) {
          console.debug('Failed to fetch initial GitHub activity:', err);
        }
        setTask(taskData.task);
        setEditTitle(taskData.task.title);
        setAttachments(attachmentsData.attachments || []);
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
  }, [slug, key, taskKey, fetchLabels]);

  const patchTask = async (fields: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}`, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      setTask((prev) => (prev ? { ...prev, ...fields } as TaskItem : null));
    } catch (err: unknown) {
      console.error('Failed to update task', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!(await confirm({ message: 'Delete this task? This action cannot be undone.', isDestructive: true }))) return;
    try {
      await apiFetch(`/workspaces/${slug}/projects/${key}/tasks/${taskKey}`, {
        method: 'DELETE',
      });
      navigate(`/w/${slug}/projects/${key}/board`);
    } catch (err: unknown) {
      console.error('Failed to delete task', err);
    }
  };

  const handleTitleSave = () => {
    if (!canEditTask || !task) return;
    if (editTitle.trim() && editTitle !== task.title) {
      patchTask({ title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleDescSave = () => {
    if (!canEditTask || !task) return;
    const currentDesc = typeof task.description === 'string' ? task.description : task.descriptionText || '';
    if (editDesc !== currentDesc) {
      patchTask({ description: editDesc });
    }
    setIsEditingDesc(false);
  };

  const addLabel = () => {
    if (!canEditTask || !task) return;
    if (!labelInput.trim()) return;
    const currentLabels = task.labels || [];
    if (!currentLabels.includes(labelInput.trim())) {
      const newLabels = [...currentLabels, labelInput.trim()];
      patchTask({ labels: newLabels });
    }
    setLabelInput('');
  };

  const removeLabel = (label: string) => {
    if (!canEditTask || !task) return;
    const newLabels = (task.labels || []).filter((l: string) => l !== label);
    patchTask({ labels: newLabels });
  };

  const handleDiscussInChannel = () => {
    // Find a channel for this project
    const projectChannel = channels.find(c => c.projectId === task?.projectId) || channels.find(c => !c.projectId && c.type !== 'dm' && c.type !== 'group_dm');
    if (projectChannel) {
      navigate(`/w/${slug}/channels/${projectChannel.channelId}?task=${taskKey}`);
    } else {
      toast.error("No channel found to discuss this task.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-foreground" strokeWidth={1.5} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-8 text-center text-subtle-foreground">
        <h2 className="text-h2 font-[590] text-foreground mb-2">Task not found</h2>
        <Button onClick={() => navigate(-1)} className="text-primary hover:underline" variant="ghost" size="default">Go back</Button>
      </div>
    );
  }

  return (
    // §14 Task Detail: "Container | Side Panel, 480px, full-screen below
    // 1024px." §8 Side Panel: `--bg-surface`, right-anchored, 1px
    // `--border-subtle` left border, translateX enter over --duration-slow.
    // It is a drawer, not a dialog: focus is not trapped and the page behind
    // stays usable, which is exactly the distinction §8 draws.
    <aside
      aria-label={`Task ${task.taskKey}`}
      className="ml-auto flex h-full w-full flex-col overflow-y-auto border-l border-border bg-card font-sans lg:w-[480px] animate-in slide-in-from-right-full duration-[--duration-slow]"
    >

      {/* §8 Side Panel header: 56px, title 15px weight 510, close ghost icon button. */}
      <div className="sticky top-0 z-(--z-sticky) flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate(-1)} size="icon" variant="ghost" aria-label="Close task">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
          <span className="text-ui font-mono text-muted-foreground bg-muted px-2 py-1 rounded border border-border">{task.taskKey}</span>
          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-subtle-foreground" strokeWidth={1.75} />}
        </div>
        <div className="flex items-center space-x-3">
          {canEditTask && (
            <Button 
              onClick={handleDeleteTask}
              className="rounded-[6px]"
              size="icon" variant="destructive" aria-label="Delete task"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
            </Button>
          )}
          <Button 
            onClick={handleDiscussInChannel}
            className="text-ui font-[510] px-3 py-1.5 bg-hover text-muted-foreground hover:text-foreground hover:bg-hover rounded transition-colors flex items-center"
            variant="secondary" size="default"
          >
            <MessageSquare className="w-4 h-4 mr-1.5" strokeWidth={1.75} /> Discuss
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 grid grid-cols-12 gap-8">
        
        {/* Main Left Content */}
        <div className="col-span-8 space-y-8">
          {/* Title Area — Click to edit */}
          <div>
            {isEditingTitle ? (
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setIsEditingTitle(false); }}
                  className="text-h3 font-[590] text-foreground bg-transparent border-0 border-b-2 border-primary px-0 py-0 flex-1"
                  autoFocus
                />
                <Button onClick={handleTitleSave} className="text-ui text-foreground bg-hover hover:bg-hover px-3 py-1 rounded" variant="secondary" size="default">Save</Button>
                <Button onClick={() => setIsEditingTitle(false)} className="text-ui text-muted-foreground hover:text-foreground" variant="ghost" size="default">Cancel</Button>
              </div>
            ) : canEditTask ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <h1 
                    className={clsx("text-h3 font-[590] text-foreground mb-4 transition-colors", canEditTask && "cursor-pointer hover:text-foreground")}
                    onClick={() => canEditTask && setIsEditingTitle(true)}
                  >
                    {task.title}
                  </h1>
                </TooltipTrigger>
                <TooltipContent>Click to edit title</TooltipContent>
              </Tooltip>
            ) : (
              <h1 
                className={clsx("text-h3 font-[590] text-foreground mb-4 transition-colors", canEditTask && "cursor-pointer hover:text-foreground")}
                onClick={() => canEditTask && setIsEditingTitle(true)}
              >
                {task.title}
              </h1>
            )}
          </div>

          {/* Description — Click to edit */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-foreground font-[590]">
                <AlignLeft className="w-5 h-5" strokeWidth={1.75} />
                <h3>Description</h3>
              </div>
              {canEditTask && !isEditingDesc && (
                <Button onClick={() => setIsEditingDesc(true)} className="text-caption text-subtle-foreground hover:text-foreground transition-colors" variant="ghost" size="default">
                  Edit
                </Button>
              )}
            </div>
            {isEditingDesc ? (
              <div className="space-y-2">
                <Textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={6}
                  className="w-full bg-background border border-border rounded-lg p-4 text-foreground text-ui leading-relaxed focus:border-ring"
                  autoFocus
                />
                <div className="flex space-x-2">
                  <Button onClick={handleDescSave} className="text-ui bg-primary text-primary-foreground px-4 py-1.5 rounded-lg font-[590] hover:bg-primary-hover" variant="primary" size="default">Save</Button>
                  <Button onClick={() => { setIsEditingDesc(false); setEditDesc(typeof task.description === 'string' ? task.description : task.descriptionText || ''); }} className="text-ui text-muted-foreground hover:text-foreground" variant="ghost" size="default">Cancel</Button>
                </div>
              </div>
            ) : (
              <div 
                className={clsx("bg-card border border-border rounded-lg p-4 min-h-[100px] transition-colors", canEditTask && "cursor-pointer hover:border-border-strong")}
                onClick={() => canEditTask && setIsEditingDesc(true)}
              >
                {/* Reading content, so `text-body` (15/1.6) and the primary text
                    tier — the placeholder drops to muted because it isn't content. */}
                <p className={clsx(
                  "text-body whitespace-pre-wrap",
                  (typeof task.description === 'string' && task.description) || task.descriptionText
                    ? "text-foreground"
                    : "text-subtle-foreground",
                )}>
                  {(typeof task.description === 'string' && task.description) || task.descriptionText || (canEditTask ? 'Click to add a description...' : 'No description provided.')}
                </p>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 text-foreground font-[590]">
                <Paperclip className="w-5 h-5" strokeWidth={1.75} />
                <h3>Attachments</h3>
                {attachments.length > 0 && <span className="text-caption text-subtle-foreground font-normal">{attachments.length}</span>}
              </div>
              {canEditTask && (
                <>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-caption text-subtle-foreground hover:text-foreground transition-colors flex items-center disabled:text-disabled"
                    variant="ghost" size="default"
                  >
                    {isUploading
                      ? <Loader2 className="w-4 h-4 animate-spin mr-1" strokeWidth={1.75} />
                      : <Plus className="w-4 h-4 mr-1" strokeWidth={1.75} />}
                    {isUploading ? 'Uploading...' : 'Attach'}
                  </Button>
                </>
              )}
            </div>
            {attachments.length === 0 ? (
              <Card className="[--card-spacing:--spacing(4)] bg-elevated/50 border border-border text-center">
                <p className="text-caption text-subtle-foreground">No attachments yet.</p>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {attachments.map(att => (
                  <div key={att.fileId} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2 hover:border-border-strong transition-colors">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => handleDownload(att.fileId)}
                          className="flex items-center min-w-0 text-left"
                          variant="ghost" size="default"
                        >
                          {attachmentIcon(att.filetype)}
                          <span className="ml-2 text-ui text-foreground truncate">{att.filename}</span>
                          {att.sizeBytes ? <span className="ml-2 text-caption text-subtle-foreground flex-shrink-0">{formatBytes(att.sizeBytes)}</span> : null}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download</TooltipContent>
                    </Tooltip>
                    <div className="flex items-center flex-shrink-0 ml-3">
                      <span className="text-micro text-subtle-foreground mr-2 hidden sm:inline">
                        {att.uploaderName || 'Unknown'}{att.createdAt ? ` · ${format(new Date(att.createdAt), 'MMM d')}` : ''}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={() => handleDownload(att.fileId)} className="text-subtle-foreground hover:text-foreground" aria-label="Download" size="icon" variant="ghost">
                            <Download className="w-4 h-4" strokeWidth={1.75} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                      </Tooltip>
                      {canEditTask && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button onClick={() => handleDeleteAttachment(att.fileId)} className="text-subtle-foreground hover:text-danger-on-muted ml-2" aria-label="Remove" size="icon" variant="destructive">
                              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discussion */}
          <div>
            <div className="flex items-center space-x-2 text-foreground font-[590] mb-4 border-b border-border pb-2">
              <MessageSquare className="w-5 h-5" strokeWidth={1.75} />
              <h3>Discussion</h3>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-muted-foreground mb-4 text-ui">Task discussions have been moved to project channels for better team visibility.</p>
              <Button
                onClick={handleDiscussInChannel}
                className="inline-flex items-center justify-center px-4 py-2 font-[510] rounded-lg transition-colors"
                variant="primary" size="default"
              >
                <MessageSquare className="w-4 h-4 mr-2" strokeWidth={1.75} />
                Discuss in Channel
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar Details */}
        <div className="col-span-4 space-y-6">
          <div className="bg-card border border-border rounded-lg p-5 space-y-5">
            <h4 className="text-caption font-[590] uppercase text-subtle-foreground mb-2">Details</h4>
            
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-ui text-subtle-foreground">Status</span>
                <Select value={task.status} onValueChange={(v) => patchTask({ status: v })} disabled={!canEditTask}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Issue Type */}
              <div className="flex items-center justify-between">
                <span className="text-ui text-subtle-foreground">Type</span>
                <Select value={task.type || 'task'} onValueChange={(v) => patchTask({ type: v })} disabled={!canEditTask}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between">
                <span className="text-ui text-subtle-foreground">Priority</span>
                <Select value={task.priority} onValueChange={(v) => patchTask({ priority: v })} disabled={!canEditTask}>
                  <SelectTrigger className="bg-elevated">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between">
                <span className="text-ui text-subtle-foreground">Assignee</span>
                <Select value={task.assigneeId || ''} onValueChange={(v) => patchTask({ assigneeId: v || null })} disabled={!canEditTask}>
                  <SelectTrigger className="bg-elevated max-w-[160px]">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m: ProjectMember) => (
                      <SelectItem key={m.userId} value={m.userId}>{m.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reporter */}
              <div className="flex items-center justify-between">
                <span className="text-ui text-subtle-foreground">Reporter</span>
                <div className="flex items-center space-x-2">
                  <Avatar size="sm" className="border border-border">
                    <AvatarFallback className="bg-hover text-micro text-foreground font-[590]">
                      {(members.find(m => m.userId === task.reporterId)?.fullName || '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-ui text-foreground font-[510]">
                    {members.find(m => m.userId === task.reporterId)?.fullName || 'System'}
                  </span>
                </div>
              </div>

              {/* Due Date */}
              <div className="flex items-center justify-between">
                <span className="text-ui text-subtle-foreground">Due Date</span>
                <Input
                  type="date"
                  value={task.dueDate ? task.dueDate.substring(0, 10) : ''}
                  onChange={e => patchTask({ dueDate: e.target.value || null })}
                  disabled={!canEditTask}
                  className="bg-background border border-border text-foreground rounded px-2 py-1 text-ui disabled:text-disabled"
                />
              </div>

              {/* Sprint */}
              <div className="flex items-center justify-between">
                <span className="text-ui text-subtle-foreground">Sprint</span>
                <Select value={task.sprintId || ''} onValueChange={(v) => patchTask({ sprintId: v || null })} disabled={!canEditTask}>
                  <SelectTrigger className="bg-elevated max-w-[160px]">
                    <SelectValue placeholder="Backlog" />
                  </SelectTrigger>
                  <SelectContent>
                    {sprints.map((s: SprintItem) => (
                      <SelectItem key={s.sprintId} value={s.sprintId}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Parent Task */}
              <div className="flex items-center justify-between">
                <span className="text-ui text-subtle-foreground">Parent Task</span>
                <Select value={task.parentTaskId || ''} onValueChange={(v) => patchTask({ parentTaskId: v || null })} disabled={!canEditTask}>
                  <SelectTrigger className="bg-elevated max-w-[160px]">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTasks.filter(t => t.taskId !== task.taskId).map((t: TaskItem) => (
                      <SelectItem key={t.taskId} value={t.taskId}>{t.taskKey} - {t.title.substring(0, 20)}...</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Points */}
              <div className="flex items-center justify-between">
                <span className="text-ui text-subtle-foreground">Points</span>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={task.storyPoints ?? ''}
                  onChange={e => patchTask({ storyPoints: e.target.value !== '' ? parseInt(e.target.value) : null })}
                  disabled={!canEditTask}
                  className="bg-background border border-border text-foreground rounded px-2 py-1 text-ui w-16 text-right disabled:text-disabled"
                  placeholder="—"
                />
              </div>

              {/* AI Estimate */}
              {task.aiDurationEstimate != null && (
                <div className="flex items-center justify-between">
                  <span className="text-ui text-subtle-foreground">AI Estimate</span>
                  <span className="flex items-center text-ui text-special font-[510]">
                    <Sparkles className="w-3 h-3 mr-1" strokeWidth={1.75} />
                    {Number(task.aiDurationEstimate)}h
                  </span>
                </div>
              )}

              {/* Labels */}
              <div>
                <span className="text-ui text-subtle-foreground block mb-2">Labels</span>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(task.labels || []).map((label: string, idx: number) => (
                    <span key={idx} className="flex items-center">
                      <LabelChip name={label} />
                      {canEditTask && (
                        <Button onClick={() => removeLabel(label)} className="ml-1.5 text-subtle-foreground hover:text-foreground" size="icon" variant="ghost">
                          <X className="w-3 h-3" strokeWidth={1.75} />
                        </Button>
                      )}
                    </span>
                  ))}
                </div>
                {canEditTask && (
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      value={labelInput}
                      onChange={e => setLabelInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLabel(); } }}
                      list={`label-suggestions-${key}`}
                      className="flex-1 bg-background border border-border text-foreground rounded px-2 py-1 text-caption md:text-caption"
                      placeholder="Add label..."
                    />
                    <datalist id={`label-suggestions-${key}`}>
                      {labelNames.map(name => <option key={name} value={name} />)}
                    </datalist>
                    <Button onClick={addLabel} className="text-caption text-muted-foreground hover:text-foreground" variant="ghost" size="default">Add</Button>
                  </div>
                )}
              </div>

              {/* GitHub Activity Sidebar Section */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <GitBranch className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                    <span className="text-ui text-foreground font-[590]">GitHub Activity</span>
                  </div>
                  {canEditTask && (
                    <div className="flex items-center space-x-1">

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => setShowCreatePR(true)}
                            className="text-micro text-muted-foreground hover:text-foreground hover:bg-hover px-1.5 py-0.5 rounded transition-colors flex items-center"
                            aria-label="Create Pull Request"
                            size="icon" variant="ghost"
                          >
                            <Plus className="w-3 h-3 mr-0.5" strokeWidth={1.75} />
                            <GitPullRequest className="w-3 h-3" strokeWidth={1.75} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Create Pull Request</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Smart Branch Suggestion */}
                  <div className="bg-card border border-border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center text-caption text-subtle-foreground font-[510] uppercase">
                        <GitBranch className="w-3 h-3 mr-1" strokeWidth={1.75} /> Smart Branch Name
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-muted border border-border text-micro text-foreground px-2 py-1.5 rounded font-mono truncate">
                        {`feature/${task.taskKey}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`}
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => {
                              const branchName = `feature/${task.taskKey}-${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
                              navigator.clipboard.writeText(`git checkout -b ${branchName}`);
                              setCopiedBranch(true);
                              setTimeout(() => setCopiedBranch(false), 2000);
                            }}
                            className="text-micro text-muted-foreground hover:text-foreground bg-hover hover:bg-hover px-2 py-1.5 rounded transition-colors flex items-center flex-shrink-0"
                            variant="secondary" size="default"
                          >
                            {copiedBranch ? <Check className="w-3 h-3 mr-1 text-success" strokeWidth={1.75} /> : <Copy className="w-3 h-3 mr-1" strokeWidth={1.75} />}
                            {copiedBranch ? 'Copied' : 'Copy'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy git checkout command</TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-micro text-subtle-foreground mt-2">
                      One-click copy to enable sync, linking, and traceability
                    </p>
                  </div>

                  {/* Pull Requests */}
                  {githubActivity.pullRequests?.length > 0 && (
                    <div>
                      <div className="flex items-center text-caption text-subtle-foreground font-[510] mb-1.5 uppercase">
                        <GitPullRequest className="w-3 h-3 mr-1" strokeWidth={1.75} /> Pull Requests
                      </div>
                      <div className="space-y-1.5">
                        {githubActivity.pullRequests.map(pr => (
                          <a key={pr.id} href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" className="block bg-card border border-border rounded p-2 hover:border-border-strong transition-colors">
                            <div className="flex items-start justify-between">
                              <span className="text-caption text-foreground font-[510] line-clamp-2 pr-2">{pr.title}</span>
                              {pr.state === 'open' && <Badge variant="success" className="text-micro px-1.5 flex-shrink-0">Open</Badge>}
                            {pr.state === 'merged' && <Badge variant="secondary" className="bg-special-muted text-special border-special-border text-micro px-1.5 flex-shrink-0">Merged</Badge>}
                              {pr.state === 'closed' && <Badge variant="destructive" className="text-micro px-1.5 flex-shrink-0">Closed</Badge>}
                            </div>
                            <div className="text-micro font-mono text-subtle-foreground mt-1">#{pr.prNumber}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Branches */}
                  {githubActivity.branches?.length > 0 && (
                    <div>
                      <div className="flex items-center text-caption text-subtle-foreground font-[510] mb-1.5 uppercase">
                        <GitBranch className="w-3 h-3 mr-1" strokeWidth={1.75} /> Branches
                      </div>
                      <div className="space-y-1.5">
                        {githubActivity.branches.map(b => (
                          <div key={b.id} className="flex flex-col bg-card border border-border rounded p-2">
                            <div className="flex items-start justify-between">
                              <span className="text-caption font-mono text-primary break-all">{b.branchName}</span>
                              {b.isDeleted && <span className="text-micro text-muted-foreground bg-hover border border-border px-1.5 py-0.5 rounded ml-2 flex-shrink-0">Deleted</span>}
                            </div>
                            {b.htmlUrl && !b.isDeleted && (
                              <a href={b.htmlUrl} target="_blank" rel="noopener noreferrer" className="text-micro text-subtle-foreground hover:text-foreground mt-1 flex items-center">
                                View on GitHub <ExternalLink className="w-3 h-3 ml-1" strokeWidth={1.75} />
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
                      <div className="flex items-center text-caption text-subtle-foreground font-[510] mb-1.5 uppercase">
                        <AlertCircle className="w-3 h-3 mr-1" strokeWidth={1.75} /> Issues
                      </div>
                      <div className="space-y-1.5">
                        {githubActivity.issues.map(issue => (
                          <a key={issue.id} href={issue.htmlUrl} target="_blank" rel="noopener noreferrer" className="block bg-card border border-border rounded p-2 hover:border-border-strong transition-colors">
                            <div className="flex items-start justify-between">
                              <span className="text-caption text-foreground font-[510] line-clamp-2 pr-2">{issue.title}</span>
                              {issue.state === 'open' ? <Badge variant="success" className="text-micro px-1.5 flex-shrink-0">Open</Badge> : <Badge variant="destructive" className="text-micro px-1.5 flex-shrink-0">Closed</Badge>}
                            </div>
                            <div className="text-micro font-mono text-subtle-foreground mt-1">#{issue.githubIssueNumber}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Commits */}
                  {githubActivity.commits?.length > 0 && (
                    <div>
                      <div className="flex items-center text-caption text-subtle-foreground font-[510] mb-1.5 uppercase">
                        <GitCommit className="w-3 h-3 mr-1" strokeWidth={1.75} /> Commits
                      </div>
                      <div className="space-y-1.5">
                        {githubActivity.commits.map(c => (
                          <a key={c.commitSha} href={c.url} target="_blank" rel="noopener noreferrer" className="block bg-card border border-border rounded p-2 hover:border-border-strong transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-caption text-primary">{c.commitSha.substring(0, 7)}</span>
                              <span className="text-micro text-subtle-foreground">{format(new Date(c.committedAt), 'MMM d')}</span>
                            </div>
                            <p className="text-caption text-foreground truncate" title={c.messageHeadline}>{c.messageHeadline}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {githubActivity.commits.length === 0 && githubActivity.pullRequests.length === 0 && githubActivity.issues.length === 0 && githubActivity.branches.length === 0 && (
                    <div className="text-center py-4 bg-card border border-border rounded-lg">
                      <p className="text-caption text-muted-foreground mb-2 font-[510]">No GitHub activity yet</p>
                      <p className="text-micro text-subtle-foreground max-w-[200px] mx-auto leading-relaxed">
                        Mention <span className="font-mono text-foreground bg-muted px-1 rounded">{taskKey}</span> in branches, PRs, issues or commits.
                      </p>
                    </div>
                  )}
                </div>
              </div>



              {/* Activity & Comments (Two-Way Sync) */}
              <TaskComments slug={slug as string} projectKey={key as string} taskKey={taskKey as string} />

              {/* Created / Updated */}
              <div className="pt-6 mt-6 border-t border-border space-y-2">
                <div className="flex justify-between text-caption">
                  <span className="text-subtle-foreground">Created</span>
                  <span className="text-subtle-foreground">{task.createdAt ? format(new Date(task.createdAt), 'MMM d, yyyy') : '—'}</span>
                </div>
                <div className="flex justify-between text-caption">
                  <span className="text-subtle-foreground">Updated</span>
                  <span className="text-subtle-foreground">{task.updatedAt ? format(new Date(task.updatedAt), 'MMM d, yyyy') : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      {showCreatePR && (
        <CreatePRModal
          slug={slug as string}
          keyStr={key as string}
          onClose={() => setShowCreatePR(false)}
          onCreated={() => {
            setShowCreatePR(false);
            fetchGithubActivity();
          }}
        />
      )}
    </aside>
  );
};
