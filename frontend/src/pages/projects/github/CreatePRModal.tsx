import { useState, useEffect } from 'react';
import { Loader2, GitPullRequest } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreatePRModalProps {
  slug: string;
  keyStr: string;
  onClose: () => void;
  onCreated: () => void;
}

export const CreatePRModal = ({ slug, keyStr, onClose, onCreated }: CreatePRModalProps) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [head, setHead] = useState('');
  const [base, setBase] = useState('main');
  const [taskId, setTaskId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<{ taskId: string; taskKey: string; title: string }[]>([]);
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

        // Extract branch names, handling duplicates
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
    if (!title || !head || !base) {
      setError('Title, source branch, and target branch are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiFetch(`/workspaces/${slug}/projects/${keyStr}/github/pull-requests`, {
        method: 'POST',
        body: JSON.stringify({ title, body, head, base, taskId: taskId || undefined })
      });
      onCreated();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create pull request');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-foreground" strokeWidth={1.75} />
            Create Pull Request
          </DialogTitle>
          <DialogDescription>
            Open a pull request in the connected GitHub repository.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-ui text-destructive" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pr-title">PR Title *</Label>
            <Input
              id="pr-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., feat: implemented new login flow"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pr-head">Source (head) *</Label>
              {branches.length > 0 ? (
                <Select value={head || undefined} onValueChange={setHead} disabled={isSubmitting || isLoadingMeta}>
                  <SelectTrigger id="pr-head" className="w-full">
                    <SelectValue placeholder="Select source branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="pr-head"
                  type="text"
                  value={head}
                  onChange={e => setHead(e.target.value)}
                  placeholder={isLoadingMeta ? 'Loading branches...' : 'e.g., feature/login-fix'}
                  disabled={isSubmitting || isLoadingMeta}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-base">Target (base) *</Label>
              {branches.length > 0 ? (
                <Select value={base || undefined} onValueChange={setBase} disabled={isSubmitting || isLoadingMeta}>
                  <SelectTrigger id="pr-base" className="w-full">
                    <SelectValue placeholder="Select target branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="pr-base"
                  type="text"
                  value={base}
                  onChange={e => setBase(e.target.value)}
                  placeholder="e.g., main"
                  disabled={isSubmitting}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pr-body">Description</Label>
            <Textarea
              id="pr-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe the changes in this PR..."
              className="h-32 resize-none"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pr-task">Link to Task (Optional)</Label>
            <Select value={taskId || undefined} onValueChange={setTaskId} disabled={isSubmitting || isLoadingMeta}>
              <SelectTrigger id="pr-task" className="w-full">
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
              disabled={isSubmitting || !title || !head || !base}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.75} /> Creating...</>
              ) : 'Create Pull Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};