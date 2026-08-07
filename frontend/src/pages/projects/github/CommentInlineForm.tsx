import { useState } from 'react';
import { Loader2, MessageSquare, Send, CheckCircle2, ExternalLink } from 'lucide-react';
import { apiFetch } from '../../../lib/api.js';

interface CommentInlineFormProps {
  slug: string;
  keyStr: string;
  type: 'issue' | 'pr';
  number: number;
  onClose: () => void;
  isEmbedded?: boolean;
}

export const CommentInlineForm = ({ slug, keyStr, type, number, onClose, isEmbedded = false }: CommentInlineFormProps) => {
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ html_url?: string } | null>(null);

  const handleSubmit = async () => {
    if (!body.trim()) {
      setError('Comment cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const endpoint = type === 'issue'
        ? `/workspaces/${slug}/projects/${keyStr}/github/issues/${number}/comments`
        : `/workspaces/${slug}/projects/${keyStr}/github/pull-requests/${number}/comments`;

      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ body: body.trim() }),
      });

      setSuccess(res.comment || {});
      setBody('');

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-300 font-medium">Comment posted on GitHub!</span>
        </div>
        {success.html_url && (
          <a 
            href={success.html_url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center"
          >
            View <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "" : "mt-2 bg-gray-950 border border-gray-700 rounded-lg overflow-hidden"}>
      {!isEmbedded && (
        <div className="flex items-center px-3 py-2 border-b border-gray-800 bg-gray-900/60">
          <MessageSquare className="w-3.5 h-3.5 text-gray-400 mr-2" />
          <span className="text-xs text-gray-400 font-medium">
            Reply to {type === 'issue' ? 'Issue' : 'PR'} #{number}
          </span>
        </div>
      )}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write a comment... (Markdown supported)"
        className="w-full bg-transparent text-sm text-gray-200 placeholder:text-gray-600 p-3 focus:outline-none resize-none h-24 custom-scrollbar"
        disabled={isSubmitting}
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      {error && (
        <div className="px-3 pb-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-800 bg-gray-900/40">
        <span className="text-[10px] text-gray-600">Ctrl+Enter to submit</span>
        <div className="flex items-center space-x-2">
          {!isEmbedded && (
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !body.trim()}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 flex items-center"
          >
            {isSubmitting ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Posting...</>
            ) : (
              <><Send className="w-3 h-3 mr-1.5" /> Comment</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
