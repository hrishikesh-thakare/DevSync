import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useChatStore, Message } from '../../store/useChatStore.js';

import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { useTaskStore } from '../../store/useTaskStore.js';
import { LexicalEditor } from '../../components/chat/LexicalEditor.js';

import { renderMessageContent } from '../../components/chat/renderMessageContent.js';
import { LinkUnfurl } from '../../components/chat/LinkUnfurl.js';
import { ReactionsModal } from '../../components/chat/ReactionsModal.js';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { Hash, Lock, Users, Loader2, Smile, MessageSquare, X, Edit2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import { socketClient } from '../../lib/socket.js';


const getStatusDotClass = (presence?: string, statusText?: string | null) => {
  if (presence === 'offline' || statusText === 'Away') return 'bg-subtle-foreground';
  if (statusText === 'In a meeting' || statusText === 'Focusing') return 'bg-danger';
  if (statusText === 'Commuting' || statusText === 'Out sick' || statusText === 'Vacationing') return 'bg-warning';
  return 'bg-success';
};

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
      <div className="w-48 h-32 bg-hover animate-pulse rounded-lg flex items-center justify-center border border-border">
        <Loader2 className="w-5 h-5 text-subtle-foreground animate-spin" strokeWidth={1.75} />
      </div>
    );
  }

  if (!imageUrl) return null;

  return (
    <a
      href={imageUrl}
      target="_blank"
      rel="noreferrer"
      className="block my-1.5 overflow-hidden rounded-lg border border-border bg-card max-w-sm group transition-transform hover:scale-[1.01]"
    >
      <img
        src={imageUrl}
        alt={fileName}
        className="max-h-64 max-w-full object-cover rounded-lg"
        loading="lazy"
      />
    </a>
  );
}

export const ChannelPage = () => {
  const { slug, channelId } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const taskKeyQuery = searchParams.get('task');

  const initialChatContent = taskKeyQuery
    ? `<p><span class="text-primary bg-primary-muted px-1 rounded font-[510]">@${taskKeyQuery}</span> </p>`
    : '';


  const { user } = useAuthStore();
  const { channels, memberCount, members, projects, isAdmin, fetchWorkspaceData, myRole } = useCurrentWorkspaceStore();
  const { messages, isLoading, joinChannel, leaveChannel, sendMessage, removeMessage, updateMessage, addReactionToMessage, removeReactionFromMessage, searchChannelMessages, clearSearch, searchResults, isSearching } = useChatStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { notifications, markAsRead } = useNotificationStore();
  
  // Mark channel notifications as read when viewing
  useEffect(() => {
    if (!channelId) return;
    const unreadInChannel = notifications.filter(n => !n.isRead && n.channelId === channelId);
    unreadInChannel.forEach(n => markAsRead(n.notificationId));
  }, [channelId, notifications, markAsRead]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  
  const currentChannel = channels.find(c => c.channelId === channelId);
  const currentProject = projects.find(p => p.projectId === currentChannel?.projectId);

  useEffect(() => {
    if (currentProject?.key) {
      fetchTasks(currentProject.key);
    }
  }, [currentProject?.key, fetchTasks]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    if (!isSearchOpen) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2 && channelId) {
      const delayFn = setTimeout(() => {
        searchChannelMessages(channelId, trimmed);
      }, 300);
      return () => clearTimeout(delayFn);
    } else if (trimmed.length === 0) {
      clearSearch();
    }
  }, [searchQuery, isSearchOpen, channelId, searchChannelMessages, clearSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchOpen(false);
    clearSearch();
  };

  // Thread State
  const [activeThreadMessageId, setActiveThreadMessageId] = useState<string | null>(null);
  const [threadReplies, setThreadReplies] = useState<Message[]>([]);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [threadsCache, setThreadsCache] = useState<Record<string, Message[]>>({});
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);

  const openReactionsModal = (msg: Message) => {
    if (!msg.reactions || msg.reactions.length === 0) return;
    setActiveReactionMessageId(msg.messageId);
  };

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
      toast.error(err instanceof Error ? err.message : 'Failed to edit message');
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!slug || !channelId || !user) return;
    
    const msg = messages.find(m => m.messageId === messageId) 
      || (activeThreadMessageId && threadsCache[activeThreadMessageId]?.find(m => m.messageId === messageId))
      || (activeThreadMessageId === messageId ? messages.find(m => m.messageId === activeThreadMessageId) : null);
    
    const hasReacted = msg?.reactions?.some((r) => r.userId === user.userId && r.emoji === emoji);
    
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
      joinChannel(channelId);
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
        reactions: [...(m.reactions || []).filter((r) => !(r.userId === data.userId && r.emoji === data.emoji)), { messageId: data.messageId, userId: data.userId, emoji: data.emoji, userName: data.userName || 'User' }]
      } : m));
    };

    const handleReactionRemoved = (data: { messageId: string; userId: string; emoji: string }) => {
      useChatStore.getState().removeReactionFromMessage(data.messageId, data);
      setThreadReplies(prev => prev.map(m => m.messageId === data.messageId ? {
        ...m,
        reactions: (m.reactions || []).filter((r) => !(r.userId === data.userId && r.emoji === data.emoji))
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



  // Auto-scroll to bottom or specific message
  useEffect(() => {
    if (scrollRef.current) {
      const messageIdQuery = searchParams.get('messageId');
      if (messageIdQuery && messages.some(m => m.messageId === messageIdQuery)) {
        const el = document.getElementById(messageIdQuery);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Flash effect
          el.classList.add('bg-primary-muted', 'transition-colors', 'duration-300');
          setTimeout(() => el.classList.remove('bg-primary-muted'), 2000);
        }
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages, searchParams]);

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
      toast.error(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setIsThreadLoading(false);
    }
  };


  const handleSendMain = async (content: string) => {
    if (slug && channelId) {
      if (isSearchOpen) {
        handleClearSearch();
      }

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const rawText = tempDiv.textContent || tempDiv.innerText || '';
      
      const matchWithKey = rawText.trim().match(/^\/task\s+(create)\s+([a-zA-Z0-9]+)\s+(.+)/i);
      const matchWithoutKey = rawText.trim().match(/^\/task\s+(create)\s+(.+)/i);

      let targetProjectKey = '';
      let title = '';

      if (matchWithKey && projects.some(p => p.key.toLowerCase() === matchWithKey[2].toLowerCase())) {
        targetProjectKey = matchWithKey[2].toUpperCase();
        title = matchWithKey[3];
      } else if (matchWithoutKey) {
        if (currentProject) {
          targetProjectKey = currentProject.key;
          title = matchWithoutKey[2];
        } else if (projects.length === 1) {
          targetProjectKey = projects[0].key;
          title = matchWithoutKey[2];
        } else if (projects.length > 1) {
          toast.error('You are not in a project channel. Please specify a project key: /task create [ProjectKey] [Title]');
          return;
        } else {
          toast.error('No projects exist in this workspace. Please create a project first.');
          return;
        }
      }

      if (targetProjectKey && title) {
        try {
          await apiFetch(`/workspaces/${slug}/projects/${targetProjectKey}/tasks`, {
            method: 'POST',
            body: JSON.stringify({ title, issueType: 'task', priority: 'medium' })
          });
          return; // Do not send normal chat message
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to create task via slash command');
          return;
        }
      }

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
        toast.error(err instanceof Error ? err.message : 'Failed to send reply');
      }
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!(await confirm('Delete message?'))) return;
    try {
      await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages/${msgId}`, { method: 'DELETE' });
      removeMessage(msgId);
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
      toast.error(err instanceof Error ? err.message : 'Failed to delete message');
    }
  };




  const handleDeleteChannel = async () => {
    if (!(await confirm('Delete this channel? This action cannot be undone.'))) return;
    try {
      await apiFetch(`/workspaces/${slug}/channels/${channelId}`, { method: 'DELETE' });
      fetchWorkspaceData(slug as string);
      navigate(`/w/${slug}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete channel');
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
      toast.error(err instanceof Error ? err.message : 'Failed to update channel name');
    }
  };

  const renderMessage = (msg: Message, isThreadContext = false) => {
    const isMe = ('authorId' in msg ? (msg as { authorId?: string }).authorId : undefined) === user?.userId || msg.senderId === user?.userId;
    const authorId = ('authorId' in msg ? (msg as { authorId?: string }).authorId : undefined) || msg.senderId;
    const authorMember = members.find(m => m.userId === authorId);

    const userFirstName = user?.fullName?.split(' ')[0]?.toLowerCase();
    const userFullNameNoSpace = user?.fullName?.replace(/\s+/g, '')?.toLowerCase();
    const userFullName = user?.fullName?.toLowerCase();
    const userDisplayName = (user as { displayName?: string } | null)?.displayName?.toLowerCase();
    const bodyLower = msg.bodyText?.toLowerCase() || '';

    const isMentioned = user?.userId && msg.bodyText && (
      msg.bodyText.includes(`data-id="${user.userId}"`) ||
      (userFirstName && bodyLower.includes(`@${userFirstName}`)) ||
      (userFullNameNoSpace && bodyLower.includes(`@${userFullNameNoSpace}`)) ||
      (userFullName && bodyLower.includes(`@${userFullName}`)) ||
      (userDisplayName && bodyLower.includes(`@${userDisplayName}`)) ||
      bodyLower.includes('@everyone') || bodyLower.includes('@channel') || bodyLower.includes('@all')
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
        id={msg.messageId}
        className={`group flex items-start py-1.5 transition-colors relative ${isThreadContext ? '' : '-mx-4 px-4'} ${
          isMentioned ? 'bg-primary-muted hover:bg-primary-muted/70 border-l-4 border-primary rounded-r-lg font-[510]' : 'hover:bg-hover rounded-lg'
        }`}
      >
        <div className="w-10 flex-shrink-0 flex justify-center">
          {showHeader && (
            <div className="relative mt-1">
              <div className="w-9 h-9 rounded-md bg-hover flex items-center justify-center text-foreground font-[590] shadow-sm border border-border">
                {msg.authorName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 ${getStatusDotClass(authorMember?.presence, authorMember?.statusText)} border-2 border-background rounded-full`}></div>
            </div>
          )}
        </div>

        <div className="ml-3 flex-1 min-w-0">
          {showHeader && (
            <div className="flex items-baseline space-x-2 mb-0.5">
              <span className="font-[590] text-foreground">{msg.authorName || 'Unknown User'}</span>
              {authorMember?.statusText && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-micro bg-hover text-muted-foreground px-1.5 py-0.5 rounded font-normal">{authorMember.statusText}</span>
                  </TooltipTrigger>
                  <TooltipContent>{authorMember.statusText}</TooltipContent>
                </Tooltip>
              )}
              <span className="text-caption text-subtle-foreground">{msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a') : ''}</span>
            </div>
          )}
          {editingMessageId === msg.messageId ? (
            <div className="mt-1 bg-background p-2 rounded-lg border border-border shadow-sm">
              <LexicalEditor 
                onSubmit={(content) => handleSaveEdit(msg.messageId, content)} 
                initialContent={msg.bodyText} 
                placeholder="Edit your message..."
              />
              <Button onClick={() => setEditingMessageId(null)} className="text-caption font-[510] text-muted-foreground hover:text-foreground mt-2 ml-1 transition-colors" variant="ghost" size="default">
                Cancel
              </Button>
            </div>
          ) : (
            <div 
              className="message-body text-foreground max-w-none"
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
                const rawName = match[1];
                const fileName = rawName.replace(/<[^>]*>?/gm, '').trim();
                const fileId = match[2];
                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
                if (!isImage) return null;
                return (
                  <FileImagePreview key={fileId} slug={slug!} fileId={fileId} fileName={fileName} />
                );
              })}
            </div>
          )}

          {/* Render Link Unfurls */}
          {(() => {
            if (!msg.bodyText || !slug) return null;
            const urlMatches = msg.bodyText.match(/https?:\/\/[^\s<"']+/gi);
            if (!urlMatches || urlMatches.length === 0) return null;
            const cleanUrls = urlMatches.map(u => u.replace(/[.,>)]+$/, ''));
            const firstExternalUrl = cleanUrls.find(u => !u.includes('localhost:') && !u.includes(window.location.host));
            if (firstExternalUrl) {
              return <LinkUnfurl url={firstExternalUrl} workspaceSlug={slug} />;
            }
            return null;
          })()}

          {!isThreadContext && !msg.isDeleted && (msg.replyCount ?? msg.threadCount ?? 0) > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <Button 
                onClick={() => toggleThreadInline(msg.messageId)}
                className="flex items-center text-ui font-[510] text-primary hover:text-primary-hover px-1 py-0.5 rounded transition-colors"
                variant="ghost" size="default"
              >
                <span className="font-mono font-[590] mr-1.5 text-heading leading-none">{expandedThreads.has(msg.messageId) ? '[-]' : '[+]'}</span>
                {msg.replyCount ?? msg.threadCount} {(msg.replyCount ?? msg.threadCount) === 1 ? 'reply' : 'replies'} inline
              </Button>

              <Button 
                onClick={() => loadThread(msg.messageId)}
                className="flex items-center text-ui font-[510] text-muted-foreground hover:text-foreground bg-hover hover:bg-hover px-2 py-1 rounded transition-colors"
                variant="secondary" size="default"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
                Sidebar
              </Button>
            </div>
          )}

          {/* Inline Nested Replies */}
          {!isThreadContext && !msg.isDeleted && expandedThreads.has(msg.messageId) && threadsCache[msg.messageId] && (
            <div className="mt-3 ml-2 pl-4 border-l-2 border-border space-y-2">
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
                msg.reactions.reduce((acc: Record<string, { count: number; userIds: string[]; userNames: string[] }>, rx) => {
                  if (!acc[rx.emoji]) acc[rx.emoji] = { count: 0, userIds: [], userNames: [] };
                  acc[rx.emoji].count++;
                  acc[rx.emoji].userIds.push(rx.userId);
                  if (rx.userName) acc[rx.emoji].userNames.push(rx.userName);
                  return acc;
                }, {})
              ).map(([emoji, data]) => {
                const hasReacted = data.userIds.includes(user?.userId || '');
                return (
                  <Tooltip key={emoji}>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => openReactionsModal(msg)}
                        aria-label={data.userNames.join(', ')}
                        className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-caption font-[510] border transition-colors ${
                          hasReacted
                            ? 'bg-primary-muted border-primary-border text-primary hover:bg-primary-muted/70'
                            : 'bg-hover border-border text-muted-foreground hover:bg-hover'
                        }`}
                        variant="secondary" size="default"
                      >
                        <span>{emoji}</span>
                        <span>{data.count}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{data.userNames.join(', ')}</TooltipContent>
                  </Tooltip>
                );
              })}

              <ReactionsModal
                isOpen={activeReactionMessageId === msg.messageId}
                onClose={() => setActiveReactionMessageId(null)}
                reactions={msg.reactions}
                currentUserId={user?.userId || ''}
                onRemoveReaction={async (emoji) => {
                  await toggleReaction(msg.messageId, emoji);
                }}
              />
            </div>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 bg-card border border-border rounded-md p-1 shadow-sm absolute right-12 -mt-3 transition-opacity">

          <div className="relative group/react">
            <Button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-hover rounded" size="icon" variant="ghost">
              <Smile className="w-4 h-4" strokeWidth={1.75} />
            </Button>
            <div className="absolute right-full top-1/2 -translate-y-1/2 pr-2 hidden group-hover/react:block z-(--z-dropdown)">
              <div className="flex items-center space-x-1 bg-card p-1.5 rounded-full shadow-md border border-border">
                {['👍', '❤️', '😂', '🎉', '👀'].map(emoji => (
                  <Button
                    key={emoji}
                    onClick={() => toggleReaction(msg.messageId, emoji)}
                    className="hover:bg-hover rounded-full w-7 h-7 flex items-center justify-center text-ui transition-transform "
                    size="icon" variant="ghost"
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {!isThreadContext && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => loadThread(msg.messageId)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-hover rounded"
                  aria-label="Reply in thread"
                  size="icon" variant="ghost"
                >
                  <MessageSquare className="w-4 h-4" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply in thread</TooltipContent>
            </Tooltip>
          )}
          {(isMe || isAdmin()) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => setEditingMessageId(msg.messageId)} 
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-hover rounded"
                  aria-label="Edit Message"
                  size="icon" variant="ghost"
                >
                  <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit Message</TooltipContent>
            </Tooltip>
          )}
          {(isMe || isAdmin()) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => deleteMessage(msg.messageId)} className="p-1.5 text-danger hover:text-danger/80 hover:bg-hover rounded" aria-label="Delete Message" size="icon" variant="destructive">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete Message</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  const parentMessage = messages.find(m => m.messageId === activeThreadMessageId);

  return (
    <div className="flex h-full bg-background font-sans overflow-hidden">

      {/* Main Channel Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <div className="h-14 border-b border-border bg-background px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center">
            {currentChannel?.type === 'private' ? (
              <Lock className="w-5 h-5 text-subtle-foreground mr-2" strokeWidth={1.75} />
            ) : (
              <Hash className="w-5 h-5 text-subtle-foreground mr-2" strokeWidth={1.75} />
            )}
            <h2 className="font-[590] text-foreground mr-2">{currentChannel?.name || 'Loading...'}</h2>
            {isAdmin() && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleUpdateChannelName}
                    className="text-subtle-foreground hover:text-foreground transition-colors"
                    aria-label="Edit Channel Name"
                    size="icon" variant="ghost"
                  >
                    <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Channel Name</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {isSearchOpen ? (
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Search className="w-4 h-4 text-subtle-foreground absolute left-2.5" strokeWidth={1.75} />
                <Input
                  type="text"
                  autoFocus
                  placeholder="Search channel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-card border border-border rounded-md pl-8 pr-8 py-1.5 text-ui text-foreground focus:border-ring focus:ring-1 focus:ring-ring w-64"
                />
                <Button type="button" onClick={handleClearSearch} className="absolute right-2 text-muted-foreground hover:text-foreground" size="icon" variant="ghost">
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </Button>
              </form>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setIsSearchOpen(true)} className="text-subtle-foreground hover:text-foreground transition-colors" aria-label="Search Channel" size="icon" variant="ghost">
                    <Search className="w-5 h-5" strokeWidth={1.75} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search Channel</TooltipContent>
              </Tooltip>
            )}
            
            {isAdmin() && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleDeleteChannel}
                    className="text-danger hover:text-danger/80 text-ui font-[510] transition-colors"
                    aria-label="Delete Channel"
                    variant="destructive" size="default"
                  >
                    Delete Channel
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Channel</TooltipContent>
              </Tooltip>
            )}
            <div className="flex items-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <Users className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
              <span className="text-ui font-[510]">{memberCount}</span>
            </div>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
          {isLoading || isSearching ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" strokeWidth={1.5} />
            </div>
          ) : isSearchOpen && searchQuery.trim().length >= 2 ? (
            searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-subtle-foreground">
                <Search className="w-12 h-12 mb-3 opacity-20" strokeWidth={1.5} />
                <p>No messages match your search.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-ui font-[590] text-muted-foreground pb-2 border-b border-border">
                  Search Results for "{searchQuery}"
                </div>
                {searchResults.map(msg => renderMessage(msg, false))}
              </div>
            )
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-subtle-foreground">
              <Hash className="w-16 h-16 mb-4 opacity-20" strokeWidth={1.5} />
              <p className="text-heading">Welcome to #{currentChannel?.name}!</p>
              <p className="text-ui">This is the start of the channel.</p>
            </div>
          ) : (
            messages.map(msg => renderMessage(msg, false))
          )}
        </div>

        {/* Input Area */}
        <div className="px-6 pb-6 pt-2 shrink-0">
          {canChat ? (
            <LexicalEditor 
              onSubmit={handleSendMain} 
              placeholder={`Message #${currentChannel?.name || 'channel'}`} 
              initialContent={initialChatContent}
              tasks={currentProject ? tasks : []}
            />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={-1} className="block">
                  <div
                    className="text-subtle-foreground text-ui text-center p-3 bg-muted rounded-lg border border-border cursor-not-allowed"
                  >
                    {currentChannel?.isAnnouncementOnly ? "Only admins can post here" : "You are a viewer and cannot send messages in this channel."}
                  </div>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {currentChannel?.isAnnouncementOnly ? "Only admins can post here" : "You are a viewer and cannot send messages in this channel"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Thread Panel */}
      {activeThreadMessageId && (
        <div className="w-96 border-l border-border bg-card flex flex-col shrink-0">
          <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center">
              <h3 className="font-[590] text-foreground">Thread</h3>
              <span className="text-subtle-foreground text-ui ml-2">#{currentChannel?.name}</span>
            </div>
            <Button onClick={() => setActiveThreadMessageId(null)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-hover rounded transition-colors" size="icon" variant="ghost">
              <X className="w-5 h-5" strokeWidth={1.75} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Original Message */}
            {parentMessage && (
              <div className="p-4 border-b border-border bg-background">
                {renderMessage(parentMessage, true)}
              </div>
            )}
            
            {/* Replies */}
            <div ref={threadScrollRef} className="flex-1 p-4 space-y-6">
              {isThreadLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" strokeWidth={1.5} /></div>
              ) : threadReplies.length === 0 ? (
                <div className="text-center py-8 text-subtle-foreground text-ui">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" strokeWidth={1.5} />
                  No replies yet. Start the conversation!
                </div>
              ) : (
                threadReplies.map((reply) => renderMessage(reply, true))
              )}
            </div>
          </div>

          {/* Thread Input Area */}
          <div className="p-4 bg-background border-t border-border shrink-0">
            {canChat ? (
              <LexicalEditor onSubmit={handleSendThread} placeholder="Reply to thread..." tasks={currentProject ? tasks : []} />
            ) : (
              <div className="text-subtle-foreground text-caption text-center p-2 bg-muted rounded border border-border">
                Read-only
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
