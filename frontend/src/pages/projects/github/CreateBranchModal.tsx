import { useState, useEffect } from 'react';
import { Loader2, GitBranch } from 'lucide-react';
import { apiFetch } from '../../../lib/api.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateBranchModalProps {
  slug: string;
  keyStr: string;
  initialTaskId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateBranchModal = ({ slug, keyStr, initialTaskId, onClose, onCreated }: CreateBranchModalProps) => {
  const [branchName, setBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [taskId, setTaskId] = useState(initialTaskId || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  interface TaskOption {
    taskId: string;
    taskKey: string;
    title: string;
  }

  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [taskRes, branchRes] = await Promise.all([
          apiFetch(`/workspaces/${slug}/projects/${keyStr}/tasks`),
          apiFetch(`/workspaces/${slug}/projects/${keyStr}/github/branches`)
        ]);
        setTasks(taskRes.tasks || []);

        const branchNames = (branchRes.branches || []).map((b: { branchName: string }) => b.branchName);
        setBranches(Array.from(new Set(branchNames)));
      } catch (err) {
        console.error('Failed to load metadata', err);
      } finally {
        setIsLoadingMeta(false);
      }
    };
    fetchMetadata();
  }, [slug, keyStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName) {
      setError('Branch name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiFetch(`/workspaces/${slug}/projects/${keyStr}/github/branches`, {
        method: 'POST',
        body: JSON.stringify({ branchName, baseBranch, taskId: taskId || undefined })
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create branch');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-foreground" strokeWidth={1.75} />
            Create Branch
          </DialogTitle>
          <DialogDescription>
            Create a new branch in the connected GitHub repository.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-ui text-destructive" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="branch-name">Branch Name *</Label>
            <Input
              id="branch-name"
              type="text"
              value={branchName}
              onChange={e => setBranchName(e.target.value.replace(/[^a-zA-Z0-9-_/]/g, ''))}
              placeholder="e.g., feature/DEV-123-new-login"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-branch">Base Branch</Label>
            <Input
              id="base-branch"
              type="text"
              value={baseBranch}
              onChange={e => setBaseBranch(e.target.value)}
              placeholder="e.g., main"
              disabled={isSubmitting}
              required
            />
            <p className="text-caption text-subtle-foreground mt-1">Leave as main if unsure. Or choose from: {branches.slice(0, 3).join(', ')}{branches.length > 3 ? '...' : ''}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-link">Link to Task (Optional)</Label>
            <Select value={taskId || undefined} onValueChange={setTaskId} disabled={isSubmitting || isLoadingMeta}>
              <SelectTrigger id="task-link" className="w-full">
                <SelectValue placeholder="No task linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No task linked</SelectItem>
                {tasks.map(t => (
                  <SelectItem key={t.taskId} value={t.taskId}>{t.taskKey} - {t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !branchName || !baseBranch}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.75} /> Creating...</>
              ) : 'Create Branch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};