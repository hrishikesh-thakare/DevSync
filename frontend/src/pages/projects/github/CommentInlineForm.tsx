import { useState } from 'react';
import { Loader2, MessageSquare, Send, CheckCircle2, ExternalLink } from 'lucide-react';
import { apiFetch } from '../../../lib/api.js';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mt-2 p-3 bg-success-muted border border-success-border rounded-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-success" strokeWidth={1.75} />
          <span className="text-ui text-success font-[510]">Comment posted on GitHub!</span>
        </div>
        {success.html_url && (
          <a 
            href={success.html_url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-caption text-success hover:underline flex items-center"
          >
            View <ExternalLink className="w-3 h-3 ml-1" strokeWidth={1.75} />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "" : "mt-2 bg-background border border-border rounded-lg overflow-hidden"}>
      {!isEmbedded && (
        <div className="flex items-center px-3 py-2 border-b border-border bg-card">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mr-2" strokeWidth={1.75} />
          <span className="text-caption text-muted-foreground font-[510]">
            Reply to {type === 'issue' ? 'Issue' : 'PR'} #{number}
          </span>
        </div>
      )}
      <Textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write a comment... (Markdown supported)"
        className="border-none bg-transparent text-ui p-3 resize-none h-24 min-h-0 rounded-none placeholder:text-subtle-foreground md:text-ui"
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
          <p className="text-caption text-danger">{error}</p>
        </div>
      )}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-card">
        <span className="text-micro text-subtle-foreground">Ctrl+Enter to submit</span>
        <div className="flex items-center space-x-2">
          {!isEmbedded && (
            <Button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-caption text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
              variant="ghost" size="default"
            >
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !body.trim()}
            className="text-caption bg-primary hover:bg-primary-hover text-primary-foreground font-[590] px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 flex items-center"
            variant="primary" size="default"
          >
            {isSubmitting ? (
              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" strokeWidth={1.75} /> Posting...</>
            ) : (
              <><Send className="w-3 h-3 mr-1.5" strokeWidth={1.75} /> Comment</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
