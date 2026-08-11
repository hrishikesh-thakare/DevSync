import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { format } from 'date-fns';
import { Send, Loader2 } from 'lucide-react';
import { socketClient } from '../../lib/socket';

interface Comment {
  commentId: string;
  threadId: string;
  bodyText: string;
  createdAt: string;
  isSystem: boolean;
  systemType?: string;
  authorId?: string;
  authorName?: string;
}

interface TaskCommentsProps {
  slug: string;
  projectKey: string;
  taskKey: string;
}

export const TaskComments: React.FC<TaskCommentsProps> = ({ slug, projectKey, taskKey }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = useAuthStore(state => state.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const data = await apiFetch(`/workspaces/${slug}/projects/${projectKey}/tasks/${taskKey}/comments`);
        setComments(data.comments || []);
      } catch (err) {
        console.error('Failed to fetch comments', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComments();
  }, [slug, projectKey, taskKey]);

  // Listen for socket events if we want real-time updates for comments
  useEffect(() => {
    const socket = socketClient.getSocket();
    if (!socket) return;

    const handleNewMessage = (msg: { threadId: string; messageId: string; bodyText: string; createdAt: string; isSystem: boolean; systemType?: string; authorId?: string; authorName?: string; }) => {
      // If the incoming message belongs to our thread, append it
      setComments(prev => {
        if (prev.length > 0 && prev[0].threadId === msg.threadId) {
          // Avoid duplicates
          if (prev.some(c => c.commentId === msg.messageId)) return prev;
          return [...prev, {
            commentId: msg.messageId,
            threadId: msg.threadId,
            bodyText: msg.bodyText,
            createdAt: msg.createdAt,
            isSystem: msg.isSystem,
            systemType: msg.systemType,
            authorId: msg.authorId,
            authorName: msg.authorName,
          }];
        }
        return prev;
      });
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const data = await apiFetch(`/workspaces/${slug}/projects/${projectKey}/tasks/${taskKey}/comments`, {
        method: 'POST',
        body: JSON.stringify({ bodyText: newComment }),
      });
      // Append optimistically if not already received via socket
      setComments(prev => {
        if (prev.some(c => c.commentId === data.comment.commentId)) return prev;
        return [...prev, data.comment];
      });
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-lg overflow-hidden mt-6">
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-950/50">
        <h3 className="text-sm font-semibold text-gray-300">Activity & Comments</h3>
        <p className="text-[10px] text-gray-500 mt-0.5">Synced with project channel</p>
      </div>
      
      <div className="flex-1 max-h-[400px] overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-xs text-gray-500 py-4">No activity yet.</p>
        ) : (
          comments.map(comment => {
            const isMe = comment.authorId === currentUser?.userId;
            
            if (comment.isSystem) {
              return (
                <div key={comment.commentId} className="flex justify-center my-2">
                  <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-full border border-gray-700">
                    {comment.bodyText}
                  </span>
                </div>
              );
            }

            return (
              <div key={comment.commentId} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline space-x-2 mb-1 mx-1">
                  <span className="text-xs font-medium text-gray-300">
                    {isMe ? 'You' : comment.authorName || 'Unknown'}
                  </span>
                  <span className="text-[9px] text-gray-500">
                    {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                  </span>
                </div>
                <div className={`px-3 py-2 rounded-lg max-w-[85%] text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm border border-gray-700'}`}>
                  {comment.bodyText}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 bg-gray-950/50 border-t border-gray-800">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment... (Syncs to channel)"
              className="w-full bg-gray-900 border border-gray-700 text-sm text-gray-200 rounded-lg pl-3 pr-10 py-2.5 focus:outline-none focus:border-blue-500 min-h-[44px] max-h-[120px] resize-y custom-scrollbar"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="h-[44px] px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center shrink-0"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
