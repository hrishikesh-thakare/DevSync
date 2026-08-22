import { useState, useEffect } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { apiFetch } from '../../../lib/api.js';
import { formatDistanceToNow } from 'date-fns';
import { CommentInlineForm } from './CommentInlineForm.js';
import { Button } from '@/components/ui/button';

interface CommentSectionProps {
  slug: string;
  keyStr: string;
  type: 'issue' | 'pr';
  number: number;
  onClose: () => void;
}

interface GitHubUser {
  login: string;
  avatarUrl: string;
}

interface GitHubComment {
  id: number;
  user: GitHubUser;
  createdAt: string;
  body: string;
}

export const CommentSection = ({ slug, keyStr, type, number, onClose }: CommentSectionProps) => {
  const [comments, setComments] = useState<GitHubComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [refreshKey, setRefreshKey] = useState(0);
  
  const handleRefresh = () => {
    setIsLoading(true);
    setError(null);
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const endpoint = type === 'issue'
          ? `/workspaces/${slug}/projects/${keyStr}/github/issues/${number}/comments`
          : `/workspaces/${slug}/projects/${keyStr}/github/pull-requests/${number}/comments`;
          
        const res = await apiFetch(endpoint);
        if (mounted) {
          setComments(res.comments || []);
        }
      } catch {
        if (mounted) {
          setError('Failed to load comments');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [slug, keyStr, type, number, refreshKey]);

  return (
    <div className="mt-2 bg-background border border-border rounded-lg overflow-hidden flex flex-col max-h-[400px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
        <div className="flex items-center">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mr-2" strokeWidth={1.75} />
          <span className="text-caption text-muted-foreground font-[510]">
            Comments on {type === 'issue' ? 'Issue' : 'PR'} #{number}
          </span>
        </div>
        <Button onClick={onClose} className="text-caption text-subtle-foreground hover:text-foreground transition-colors" variant="ghost" size="default">Close</Button>
      </div>
      
      <div className="overflow-y-auto flex-1 p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-subtle-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" strokeWidth={1.75} /> Loading comments...
          </div>
        ) : error ? (
          <div className="text-center py-4 text-caption text-danger">{error}</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4 text-caption text-subtle-foreground">No comments yet. Be the first to comment!</div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="flex space-x-3">
              <img src={comment.user.avatarUrl} alt={comment.user.login} className="w-6 h-6 rounded-full" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline space-x-2">
                  <span className="text-caption font-[590] text-foreground">{comment.user.login}</span>
                  <span className="text-micro text-subtle-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-0.5 text-caption text-foreground whitespace-pre-wrap break-words bg-card border border-border p-2 rounded">
                  {comment.body}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 bg-card border-t border-border">
        <CommentInlineForm 
          slug={slug} 
          keyStr={keyStr} 
          type={type} 
          number={number} 
          onClose={handleRefresh} 
          isEmbedded={true}
        />
      </div>
    </div>
  );
};
