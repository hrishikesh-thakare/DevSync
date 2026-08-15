import { useState, useEffect } from 'react';
import { X, Loader2, GitPullRequest } from 'lucide-react';
import { apiFetch } from '../../../lib/api.js';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <GitPullRequest className="w-5 h-5 text-gray-300" />
            <h2 className="text-lg font-bold text-white">Create Pull Request</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1.5">PR Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., feat: implemented new login flow"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-300">Source (head) *</label>
              </div>
              {branches.length > 0 ? (
                <select
                  value={head}
                  onChange={e => setHead(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  disabled={isSubmitting || isLoadingMeta}
                >
                  <option value="">Select source branch</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={head}
                  onChange={e => setHead(e.target.value)}
                  placeholder={isLoadingMeta ? "Loading branches..." : "e.g., feature/login-fix"}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  disabled={isSubmitting || isLoadingMeta}
                />
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-300">Target (base) *</label>
              </div>
              {branches.length > 0 ? (
                <select
                  value={base}
                  onChange={e => setBase(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  disabled={isSubmitting || isLoadingMeta}
                >
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={base}
                  onChange={e => setBase(e.target.value)}
                  placeholder="e.g., main"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1.5">Description</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe the changes in this PR..."
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-32 resize-none custom-scrollbar"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1.5">Link to Task (Optional)</label>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={isSubmitting || isLoadingMeta}
            >
              <option value="">No task linked</option>
              {tasks.map(t => (
                <option key={t.taskId} value={t.taskId}>{t.taskKey} - {t.title}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title || !head || !base}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
              ) : 'Create Pull Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
