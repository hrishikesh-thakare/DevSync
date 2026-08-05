import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../../lib/api.js';

interface CreateIssueModalProps {
  slug: string;
  keyStr: string;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateIssueModal = ({ slug, keyStr, onClose, onCreated }: CreateIssueModalProps) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [labels, setLabels] = useState('');
  const [taskId, setTaskId] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await apiFetch(`/workspaces/${slug}/projects/${keyStr}/tasks`);
        setTasks(res.tasks || []);
      } catch (err) {
        console.error('Failed to load tasks', err);
      } finally {
        setIsLoadingMeta(false);
      }
    };
    fetchMetadata();
  }, [slug, keyStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      setError('Issue title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const parsedLabels = labels.split(',').map(l => l.trim()).filter(l => l.length > 0);

    try {
      await apiFetch(`/workspaces/${slug}/projects/${keyStr}/github/issues`, {
        method: 'POST',
        body: JSON.stringify({ title, body, labels: parsedLabels, taskId: taskId || undefined })
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to create issue');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-gray-300" />
            <h2 className="text-lg font-bold text-white">Create Issue</h2>
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
            <label className="block text-sm font-semibold text-gray-300 mb-1.5">Issue Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Bug: Application crashes on login"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1.5">Description</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-32 resize-none custom-scrollbar"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1.5">Labels (comma-separated)</label>
            <input
              type="text"
              value={labels}
              onChange={e => setLabels(e.target.value)}
              placeholder="e.g., bug, enhancement, high-priority"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              disabled={isSubmitting || !title}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
              ) : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
