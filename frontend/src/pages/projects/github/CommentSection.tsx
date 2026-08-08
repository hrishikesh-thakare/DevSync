import { useState, useEffect } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { apiFetch } from '../../../lib/api.js';
import { formatDistanceToNow } from 'date-fns';
import { CommentInlineForm } from './CommentInlineForm.js';

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
    <div className="mt-2 bg-gray-950 border border-gray-700 rounded-lg overflow-hidden flex flex-col max-h-[400px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/60">
        <div className="flex items-center">
          <MessageSquare className="w-3.5 h-3.5 text-gray-400 mr-2" />
          <span className="text-xs text-gray-400 font-medium">
            Comments on {type === 'issue' ? 'Issue' : 'PR'} #{number}
          </span>
        </div>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-white transition-colors">Close</button>
      </div>
      
      <div className="overflow-y-auto custom-scrollbar flex-1 p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading comments...
          </div>
        ) : error ? (
          <div className="text-center py-4 text-xs text-red-400">{error}</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4 text-xs text-gray-500">No comments yet. Be the first to comment!</div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="flex space-x-3">
              <img src={comment.user.avatarUrl} alt={comment.user.login} className="w-6 h-6 rounded-full" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline space-x-2">
                  <span className="text-xs font-bold text-gray-200">{comment.user.login}</span>
                  <span className="text-[10px] text-gray-500">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-gray-300 whitespace-pre-wrap break-words bg-gray-900 border border-gray-800 p-2 rounded">
                  {comment.body}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 bg-gray-900/40 border-t border-gray-800">
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
