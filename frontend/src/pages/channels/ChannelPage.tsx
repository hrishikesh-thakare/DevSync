import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useChatStore, Message } from '../../store/useChatStore.js';

import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { useTaskStore } from '../../store/useTaskStore.js';
import { LexicalEditor } from '../../components/chat/LexicalEditor.js';

import { renderMessageContent } from '../../components/chat/renderMessageContent.js';

import { Hash, Lock, Users, Loader2, Smile, MessageSquare, X, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { apiFetch } from '../../lib/api.js';
import { socketClient } from '../../lib/socket.js';


function FileImagePreview({ slug, fileId, fileName }: { slug: string; fileId: string; fileName: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiFetch(`/workspaces/${slug}/files/${fileId}/download`)
      .then((res) => {
        if (isMounted && res.downloadUrl) setImageUrl(res.downloadUrl);
      })
      .catch((err) => console.error('Failed to load image preview', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [slug, fileId]);

  if (loading) {
    return (
      <div className="w-48 h-32 bg-gray-800/60 animate-pulse rounded-lg flex items-center justify-center border border-gray-700/50">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    );
  }

  if (!imageUrl) return null;

  return (
    <a
      href={imageUrl}
      target="_blank"
      rel="noreferrer"
      className="block my-1.5 overflow-hidden rounded-xl border border-gray-700/60 bg-gray-900 max-w-sm group transition-transform hover:scale-[1.01]"
    >
      <img
        src={imageUrl}
        alt={fileName}
        className="max-h-64 max-w-full object-cover rounded-xl"
        loading="lazy"
      />
    </a>
  );
}

export const ChannelPage = () => {
  const { slug, channelId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskKeyQuery = searchParams.get('task');

  const initialChatContent = taskKeyQuery
    ? `<p><span class="text-blue-400 bg-blue-500/10 px-1 rounded font-medium">@${taskKeyQuery}</span> </p>`
    : '';


  const { user } = useAuthStore();
  const { channels, memberCount, members, isAdmin, fetchWorkspaceData, myRole } = useCurrentWorkspaceStore();
  const { messages, isLoading, joinChannel, leaveChannel, sendMessage, removeMessage, updateMessage, addReactionToMessage, removeReactionFromMessage } = useChatStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  
  const currentChannel = channels.find(c => c.channelId === channelId);

  // Thread State
  const [activeThreadMessageId, setActiveThreadMessageId] = useState<string | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [threadsCache, setThreadsCache] = useState<Record<string, Message[]>>({});

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [canChat, setCanChat] = useState(true);

  const handleSaveEdit = async (messageId: string, newContent: string) => {
    if (!slug || !channelId) return;
    try {
      // Optimistic update
      updateMessage({ messageId, bodyText: newContent });
      setThreadReplies(prev => prev.map(m => m.messageId === messageId ? { ...m, bodyText: newContent } : m));
      setThreadsCache(prev => {
        const next = { ...prev };
        for (const k in next) {
          next[k] = next[k].map(m => m.messageId === messageId ? { ...m, bodyText: newContent } : m);
        }
        return next;
      });
      setEditingMessageId(null);

      await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ bodyText: newContent })
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to edit message');
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!slug || !channelId || !user) return;
    
    const msg = messages.find(m => m.messageId === messageId) 
      || (activeThreadMessageId && threadsCache[activeThreadMessageId]?.find(m => m.messageId === messageId))
      || (activeThreadMessageId === messageId ? messages.find(m => m.messageId === activeThreadMessageId) : null);
    
    const hasReacted = msg?.reactions?.some((r: any) => r.userId === user.userId && r.emoji === emoji);
    
    // Optimistic UI update
    if (hasReacted) {
      removeReactionFromMessage(messageId, { userId: user.userId, emoji });
    } else {
      addReactionToMessage(messageId, { userId: user.userId, emoji, userName: user.fullName || 'Me' });
    }

    try {
      if (hasReacted) {
        await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages/${messageId}/reactions`, {
          method: 'POST',
          body: JSON.stringify({ emoji })
        });
      }
    } catch (err) {
      console.error('Failed to toggle reaction', err);
      // Revert if error
      if (hasReacted) {
        addReactionToMessage(messageId, { userId: user.userId, emoji, userName: user.fullName || 'Me' });
      } else {
        removeReactionFromMessage(messageId, { userId: user.userId, emoji });
      }
    }
  };

  useEffect(() => {
    const checkPermissions = async () => {
      if (!currentChannel) return;

      if (currentChannel.projectId) {
        try {
          const project = useCurrentWorkspaceStore.getState().projects.find(p => p.projectId === currentChannel.projectId);
          if (!project) throw new Error('Project not found in store');
          
          interface ProjectMember {
            userId: string;
            role: string;
          }
          const data = await apiFetch(`/workspaces/${slug}/projects/${project.key}/members`);
          const members: ProjectMember[] = data.members || [];
          const myMembership = members.find((m) => m.userId === user?.userId);

          
          if (isAdmin()) {
            setCanChat(true);
          } else {
            setCanChat(myMembership?.role !== 'viewer');
          }
        } catch (err) {
          console.error(err);
          setCanChat(false);
        }
      } else {
        // All workspace roles ('owner', 'admin', 'member') can chat in workspace channels
        // EXCEPT if it is announcement only
        if (currentChannel?.isAnnouncementOnly) {
          setCanChat(myRole === 'owner' || myRole === 'admin');
        } else {
          setCanChat(true);
        }
      }
    };
    checkPermissions();
  }, [currentChannel, slug, user?.userId, isAdmin, myRole]);


  const [prevChannelId, setPrevChannelId] = useState(channelId);
  if (channelId !== prevChannelId) {
    setPrevChannelId(channelId);
    setActiveThreadMessageId(null);
  }

  useEffect(() => {
    if (slug && channelId) {
      joinChannel(slug, channelId);
      if (currentChannel?.projectId) {
        const project = useCurrentWorkspaceStore.getState().projects.find(p => p.projectId === currentChannel.projectId);
        if (project?.key) {
          useTaskStore.getState().fetchTasks(project.key);
        }
      } else {
        // Workspace wide channels have no project tasks
        useTaskStore.setState({ tasks: [] });
      }
    }
    return () => leaveChannel();
  }, [slug, channelId, currentChannel, joinChannel, leaveChannel]);


  useEffect(() => {
    const socket = socketClient.getSocket();

    const handleNewMessage = (msg: Message) => {
      if (msg.threadId) {
        setThreadReplies((prev) => [...prev, msg]);
        setThreadsCache((prev) => ({
          ...prev,
          [msg.threadId as string]: [...(prev[msg.threadId as string] || []), msg]
        }));
        useChatStore.getState().fetchMessages(channelId!); // to update reply count
      } else {
        useChatStore.getState().fetchMessages(channelId!);
      }
    };

    const handleMessageUpdated = (updatedMsg: Message) => {
      useChatStore.getState().updateMessage(updatedMsg);
      if (updatedMsg.threadId) {
        setThreadReplies((prev) => prev.map(m => m.messageId === updatedMsg.messageId ? { ...m, ...updatedMsg } : m));
        setThreadsCache((prev) => {
          const thread = prev[updatedMsg.threadId as string] || [];
          return { ...prev, [updatedMsg.threadId as string]: thread.map(m => m.messageId === updatedMsg.messageId ? { ...m, ...updatedMsg } : m) };
        });
      }
    };

    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      setThreadReplies((prev) => prev.filter((m) => m.messageId !== messageId));
      setThreadsCache((prev) => {
        const updated = { ...prev };
        delete updated[messageId];
        for (const parentId in updated) {
          updated[parentId] = updated[parentId].filter((m) => m.messageId !== messageId);
        }
        return updated;
      });
      setExpandedThreads((prev) => {
        if (prev.has(messageId)) {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        }
        return prev;
      });
      setActiveThreadMessageId((prev) => (prev === messageId ? null : prev));
      useChatStore.getState().fetchMessages(channelId!);
    };

    const handleReactionAdded = (data: { messageId: string; userId: string; emoji: string; userName?: string }) => {
      useChatStore.getState().addReactionToMessage(data.messageId, data);
      setThreadReplies(prev => prev.map(m => m.messageId === data.messageId ? {
        ...m,
        reactions: [...((m as any).reactions || []).filter((r: any) => !(r.userId === data.userId && r.emoji === data.emoji)), { messageId: data.messageId, userId: data.userId, emoji: data.emoji, userName: data.userName || 'User' }]
      } : m));
    };

    const handleReactionRemoved = (data: { messageId: string; userId: string; emoji: string }) => {
      useChatStore.getState().removeReactionFromMessage(data.messageId, data);
      setThreadReplies(prev => prev.map(m => m.messageId === data.messageId ? {
        ...m,
        reactions: ((m as any).reactions || []).filter((r: any) => !(r.userId === data.userId && r.emoji === data.emoji))
      } : m));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_reaction_added', handleReactionAdded);
    socket.on('message_reaction_removed', handleReactionRemoved);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_reaction_added', handleReactionAdded);
      socket.off('message_reaction_removed', handleReactionRemoved);
    };
  }, [channelId, slug]);



  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-scroll thread
  useEffect(() => {
    if (threadScrollRef.current) {
      threadScrollRef.current.scrollTop = threadScrollRef.current.scrollHeight;
    }
  }, [threadReplies]);

  const toggleThreadInline = async (messageId: string) => {
    const newSet = new Set(expandedThreads);
    if (newSet.has(messageId)) {
      newSet.delete(messageId);
      setExpandedThreads(newSet);
    } else {
      newSet.add(messageId);
      setExpandedThreads(newSet);
      if (!threadsCache[messageId]) {
        try {
          const data = await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages/${messageId}/thread`);
          setThreadsCache(prev => ({ ...prev, [messageId]: data.replies || [] }));
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  const loadThread = async (messageId: string) => {
    setActiveThreadMessageId(messageId);
    setIsThreadLoading(true);
    try {
      const data = await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages/${messageId}/thread`);
      setThreadReplies(data.replies || []);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setIsThreadLoading(false);
    }
  };


  const handleSendMain = async (content: string) => {
    if (slug && channelId) {
      await sendMessage(channelId, content);
    }
  };

  const handleSendThread = async (content: string) => {
    if (slug && channelId && activeThreadMessageId) {
      try {
        const data = await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ bodyText: content, threadId: activeThreadMessageId }),
        });
        setThreadReplies([...threadReplies, data.data]);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to send reply');
      }
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!confirm('Delete message?')) return;
    try {
      const targetMsg = messages.find(m => m.messageId === msgId) || threadReplies.find(m => m.messageId === msgId);
      const threadId = targetMsg?.threadId || null;


      await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages/${msgId}`, { method: 'DELETE' });
      removeMessage(msgId, threadId);
      setThreadReplies((prev) => prev.filter((m) => m.messageId !== msgId));
      setThreadsCache((prev) => {
        const updated = { ...prev };
        delete updated[msgId];
        for (const parentId in updated) {
          updated[parentId] = updated[parentId].filter((m) => m.messageId !== msgId);
        }
        return updated;
      });
      setExpandedThreads((prev) => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
      if (activeThreadMessageId === msgId) {
        setActiveThreadMessageId(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete message');
    }
  };




  const handleDeleteChannel = async () => {
    if (!confirm('Are you sure you want to delete this channel?')) return;
    try {
      await apiFetch(`/workspaces/${slug}/channels/${channelId}`, { method: 'DELETE' });
      fetchWorkspaceData(slug as string);
      navigate(`/w/${slug}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete channel');
    }
  };


  const handleUpdateChannelName = async () => {
    if (!currentChannel) return;
    const newName = prompt('Enter new channel name:', currentChannel.name);
    if (!newName || newName === currentChannel.name) return;
    
    try {
      await apiFetch(`/workspaces/${slug}/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName })
      });
      fetchWorkspaceData(slug as string);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update channel name');
    }
  };

  const renderMessage = (msg: Message, isThreadContext = false) => {
    const isMe = ('authorId' in msg ? (msg as { authorId?: string }).authorId : undefined) === user?.userId || msg.senderId === user?.userId;
    const authorId = ('authorId' in msg ? (msg as { authorId?: string }).authorId : undefined) || msg.senderId;
    const authorMember = members.find(m => m.userId === authorId);

    const isMentioned = user?.userId && msg.bodyText && (
      msg.bodyText.includes(`data-id="${user.userId}"`) ||
      (user.fullName && msg.bodyText.toLowerCase().includes(`@${user.fullName.toLowerCase()}`)) ||
      (user.displayName && msg.bodyText.toLowerCase().includes(`@${user.displayName.toLowerCase()}`)) ||
      msg.bodyText.includes('@everyone') || msg.bodyText.includes('@channel') || msg.bodyText.includes('@all')
    );

    // Basic logic for headers (simplified for thread)
    const showHeader = true;

    // Render raw HTML — convert file markers and task mentions into styled anchors/spans
    const htmlContent = renderMessageContent(msg.bodyText || '');

    // Extract any file attachments in the message to display image previews
    const fileMatches = Array.from((msg.bodyText || '').matchAll(/\[(.*?)\]\(file:([a-zA-Z0-9-]+)\)/g)) as RegExpMatchArray[];

    return (
      <div 
        key={msg.messageId} 
        className={`group flex items-start py-1 hover:bg-gray-900/40 transition-colors relative ${isThreadContext ? '' : '-mx-4 px-4'} ${isMentioned ? 'bg-amber-500/10 hover:bg-amber-500/20 rounded-none' : 'rounded-lg'}`}
      >
        {isMentioned && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r-full" />}
        <div className="w-10 flex-shrink-0 flex justify-center">
          {showHeader && (
            <div className="relative mt-1">
              <div className="w-9 h-9 rounded-md bg-gradient-to-br from-gray-700 to-gray-500 flex items-center justify-center text-white font-bold shadow-md border border-gray-800">
                {msg.authorName?.[0]?.toUpperCase() || 'U'}
              </div>
              {authorMember?.presence === 'online' && (
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 border-2 border-gray-950 rounded-full"></div>
              )}
            </div>
          )}
        </div>

        <div className="ml-3 flex-1 min-w-0">
          {showHeader && (
            <div className="flex items-baseline space-x-2 mb-0.5">
              <span className="font-semibold text-gray-100">{msg.authorName || 'Unknown User'}</span>
              {authorMember?.statusEmoji && (
                <span className="text-xs" title={authorMember.statusText || ''}>{authorMember.statusEmoji}</span>
              )}
              <span className="text-xs text-gray-500">{msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : ''}</span>
            </div>
          )}
          {editingMessageId === msg.messageId ? (
            <div className="mt-1 bg-gray-950/50 p-2 rounded-lg border border-gray-700 shadow-sm">
              <LexicalEditor 
                onSubmit={(content) => handleSaveEdit(msg.messageId, content)} 
                initialContent={msg.bodyText} 
                placeholder="Edit your message..."
              />
              <button onClick={() => setEditingMessageId(null)} className="text-xs font-medium text-gray-400 hover:text-white mt-2 ml-1 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <div 
              className="text-gray-300 text-[15px] leading-relaxed prose prose-invert max-w-none prose-p:my-0 prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800 prose-code:before:content-none prose-code:after:content-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              onClick={async (e) => {
              const target = e.target as HTMLElement;
              const fileLink = target.closest('[data-file-id]');
              if (fileLink) {
                e.preventDefault();
                const fileId = fileLink.getAttribute('data-file-id');
                const fileName = fileLink.getAttribute('data-file-name') || '';
                const isPreviewable = /\.(jpg|jpeg|png|gif|webp|pdf|txt|csv|mp4|webm)$/i.test(fileName);
                
                console.log(`[File Click] id=${fileId}, fileName=${fileName}, isPreviewable=${isPreviewable}`);

                let win: Window | null = null;
                if (isPreviewable) {
                  console.log(`[File Click] Opening synchronous about:blank tab for preview...`);
                  win = window.open('about:blank', '_blank');
                }

                try {
                  console.log(`[File Click] Fetching download URL from backend...`);
                  const res = await apiFetch(`/workspaces/${slug}/files/${fileId}/download`);
                  console.log(`[File Click] Backend response:`, res);

                  if (res.downloadUrl) {
                    if (isPreviewable && win) {
                      console.log(`[File Click] Navigating preview tab to: ${res.downloadUrl}`);
                      win.location.href = res.downloadUrl;
                    } else {
                      console.log(`[File Click] Triggering background download for: ${res.downloadUrl}`);
                      const a = document.createElement('a');
                      a.href = res.downloadUrl;
                      a.rel = 'noreferrer';
                      if (fileName) a.download = fileName;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  } else {
                    console.warn(`[File Click] No downloadUrl in response! Closing tab if open.`);
                    if (win) win.close();
                  }
                } catch (err) {
                  console.error('[File Click] Failed to get download URL', err);
                  if (win) win.close();
                }
                return;
              }

              const taskLink = target.closest('[data-task-key]');
              if (taskLink) {
                e.preventDefault();
                let taskKey = taskLink.getAttribute('data-task-key');
                if (taskKey) {
                  taskKey = taskKey.replace(/^@/, '');
                  const projectKey = taskKey.split('-')[0];
                  navigate(`/w/${slug}/projects/${projectKey}/tasks/${taskKey}`);
                }
              }
            }}
          />
          )}

          {/* Render Image Previews for Image Files */}
          {fileMatches.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {fileMatches.map((match) => {
                const fileName = match[1];
                const fileId = match[2];
                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
                if (!isImage) return null;
                return (
                  <FileImagePreview key={fileId} slug={slug!} fileId={fileId} fileName={fileName} />
                );
              })}
            </div>
          )}

          {!isThreadContext && !msg.isDeleted && (msg.replyCount ?? msg.threadCount ?? 0) > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <button 
                onClick={() => toggleThreadInline(msg.messageId)}
                className="flex items-center text-sm font-medium text-blue-400 hover:text-blue-300 px-1 py-0.5 rounded transition-colors"
              >
                <span className="font-mono font-bold mr-1.5 text-lg leading-none">{expandedThreads.has(msg.messageId) ? '[-]' : '[+]'}</span>
                {msg.replyCount ?? msg.threadCount} {(msg.replyCount ?? msg.threadCount) === 1 ? 'reply' : 'replies'} inline
              </button>

              <button 
                onClick={() => loadThread(msg.messageId)}
                className="flex items-center text-sm font-medium text-gray-400 hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800 px-2 py-1 rounded transition-colors"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" />
                Sidebar
              </button>
            </div>
          )}

          {/* Inline Nested Replies */}
          {!isThreadContext && !msg.isDeleted && expandedThreads.has(msg.messageId) && threadsCache[msg.messageId] && (
            <div className="mt-3 ml-2 pl-4 border-l-2 border-gray-800 space-y-2">
              {threadsCache[msg.messageId].map((reply: Message) => (
                <div key={reply.messageId} className="relative">
                  {renderMessage(reply, true)}
                </div>
              ))}
            </div>
          )}

          {/* Reaction Pills */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(
                (msg.reactions as any[]).reduce((acc: any, rx: any) => {
                  if (!acc[rx.emoji]) acc[rx.emoji] = { count: 0, userIds: [], userNames: [] };
                  acc[rx.emoji].count++;
                  acc[rx.emoji].userIds.push(rx.userId);
                  acc[rx.emoji].userNames.push(rx.userName);
                  return acc;
                }, {})
              ).map(([emoji, data]: [string, any]) => {
                const hasReacted = data.userIds.includes(user?.userId);
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(msg.messageId, emoji)}
                    title={data.userNames.join(', ')}
                    className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      hasReacted 
                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30' 
                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{data.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 bg-gray-900 border border-gray-800 rounded-md p-1 shadow-sm absolute right-6 -mt-3 transition-opacity">
          
          <div className="relative group/react">
            <button className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded">
              <Smile className="w-4 h-4" />
            </button>
            <div className="absolute bottom-full right-0 pb-1 hidden group-hover/react:block z-50">
              <div className="flex items-center space-x-1 bg-gray-900 p-1.5 rounded-full shadow-lg border border-gray-700">
                {['👍', '❤️', '😂', '🎉', '👀'].map(emoji => (
                  <button 
                    key={emoji} 
                    onClick={() => toggleReaction(msg.messageId, emoji)} 
                    className="hover:bg-gray-700 rounded-full w-7 h-7 flex items-center justify-center text-sm transition-transform hover:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!isThreadContext && (
            <button 
              onClick={() => loadThread(msg.messageId)}
              className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded" 
              title="Reply in thread"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
          {(isMe || isAdmin()) && (
            <button 
              onClick={() => setEditingMessageId(msg.messageId)} 
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded" 
              title="Edit Message"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {(isMe || isAdmin()) && (
            <button onClick={() => deleteMessage(msg.messageId)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-gray-800 rounded" title="Delete Message">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  const parentMessage = messages.find(m => m.messageId === activeThreadMessageId);

  return (
    <div className="flex h-full bg-gray-950 font-sans overflow-hidden">
      
      {/* Main Channel Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <div className="h-14 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center">
            {currentChannel?.type === 'private' ? (
              <Lock className="w-5 h-5 text-gray-500 mr-2" />
            ) : (
              <Hash className="w-5 h-5 text-gray-500 mr-2" />
            )}
            <h2 className="font-bold text-gray-100 mr-2">{currentChannel?.name || 'Loading...'}</h2>
            {isAdmin() && (
              <button 
                onClick={handleUpdateChannelName}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Edit Channel Name"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {isAdmin() && (
              <button 
                onClick={handleDeleteChannel}
                className="text-red-500 hover:text-red-400 text-sm font-medium transition-colors"
                title="Delete Channel"
              >
                Delete Channel
              </button>
            )}
            <div className="flex items-center text-gray-400 hover:text-gray-200 cursor-pointer transition-colors">
              <Users className="w-4 h-4 mr-1.5" />
              <span className="text-sm font-medium">{memberCount}</span>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-4 border border-gray-800">
                {currentChannel?.type === 'private' ? <Lock className="w-8 h-8" /> : <Hash className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-bold text-gray-300 mb-2">Welcome to #{currentChannel?.name}</h3>
              <p className="text-sm">This is the beginning of this channel's history.</p>
            </div>
          ) : (
            messages.map((msg) => renderMessage(msg, false))
          )}
        </div>

        {/* Input Area */}
        <div className="px-6 pb-6 pt-2 shrink-0">
          {canChat ? (
            <LexicalEditor 
              onSubmit={handleSendMain} 
              placeholder={`Message #${currentChannel?.name || 'channel'}`} 
              initialContent={initialChatContent}
            />
          ) : (
            <div 
              title={currentChannel?.isAnnouncementOnly ? "Only admins can post here" : "You are a viewer and cannot send messages in this channel"}
              className="text-gray-500 text-sm text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800 cursor-not-allowed"
            >
              {currentChannel?.isAnnouncementOnly ? "Only admins can post here" : "You are a viewer and cannot send messages in this channel."}
            </div>
          )}
        </div>
      </div>

      {/* Thread Panel */}
      {activeThreadMessageId && (
        <div className="w-96 border-l border-gray-800/60 bg-gray-900/50 flex flex-col shrink-0">
          <div className="h-14 border-b border-gray-800/60 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center">
              <h3 className="font-bold text-gray-100">Thread</h3>
              <span className="text-gray-500 text-sm ml-2">#{currentChannel?.name}</span>
            </div>
            <button onClick={() => setActiveThreadMessageId(null)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            {/* Original Message */}
            {parentMessage && (
              <div className="p-4 border-b border-gray-800/60 bg-gray-950/50">
                {renderMessage(parentMessage, true)}
              </div>
            )}
            
            {/* Replies */}
            <div ref={threadScrollRef} className="flex-1 p-4 space-y-6">
              {isThreadLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>
              ) : threadReplies.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No replies yet. Start the conversation!
                </div>
              ) : (
                threadReplies.map((reply) => renderMessage(reply, true))
              )}
            </div>
          </div>

          {/* Thread Input Area */}
          <div className="p-4 bg-gray-950/80 border-t border-gray-800/60 shrink-0">
            {canChat ? (
              <LexicalEditor onSubmit={handleSendThread} placeholder="Reply to thread..." />
            ) : (
              <div className="text-gray-500 text-xs text-center p-2 bg-gray-900/50 rounded border border-gray-800">
                Read-only
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
