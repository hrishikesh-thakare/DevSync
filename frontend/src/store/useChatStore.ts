import { create } from 'zustand';
import { apiFetch } from '../lib/api';
import { useWorkspaceStore } from './workspaceStore';

import { useCurrentWorkspaceStore } from './currentWorkspace.js';
import { socketClient } from '../lib/socket.js';
export interface MessageReaction {
  reactionId?: string;
  messageId: string;
  userId: string;
  emoji: string;
  userName?: string;
  createdAt?: string;
}

export interface Message {
  messageId: string;
  id?: string;
  channelId: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  senderId?: string;
  bodyText?: string;
  body?: string;
  isSystem?: boolean;
  systemType?: string;
  createdAt: string;
  replyCount: number;
  threadCount?: number;
  threadId: string | null;
  isDeleted?: boolean;
  reactions?: MessageReaction[];
}

export interface Channel {
  channelId: string;
  name?: string;
  slug: string;
  type: string;
  description?: string;
}

interface ChatState {
  channels: Channel[];
  activeChannel: Channel | null;
  fetchChannels: () => Promise<void>;
  setActiveChannel: (channelId: string) => void;
  messages: Message[];
  threads: Record<string, Message[]>;
  searchResults: Message[];
  isSearching: boolean;
  activeChannelId: string | null;
  isLoading: boolean;
  fetchMessages: (channelId: string) => Promise<void>;
  fetchThreadReplies: (channelId: string, parentMessageId: string) => Promise<Message[]>;
  sendMessage: (channelId: string, bodyText: string, threadId?: string | null) => Promise<void>;
  updateMessage: (msg: Partial<Message> & { messageId: string }) => void;
  removeMessage: (messageId: string) => void;
  addReactionToMessage: (messageId: string, rx: { userId: string; emoji: string; userName?: string }) => void;
  removeReactionFromMessage: (messageId: string, rx: { userId: string; emoji: string }) => void;
  uploadFile: (file: File) => Promise<{ fileId: string, filename: string } | null>;
  searchChannelMessages: (channelId: string, q: string) => Promise<void>;
  clearSearch: () => void;
  joinChannel: (channelId: string) => void;
  leaveChannel: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  channels: [],
  activeChannel: null,
  messages: [],
  threads: {},
  searchResults: [],
  isSearching: false,
  activeChannelId: null,
  isLoading: false,

  setActiveChannel: (channelId: string) => {
    const channel = get().channels.find(c => c.channelId === channelId) || null;
    set({ activeChannel: channel, activeChannelId: channelId });
  },

  fetchChannels: async () => {
    try {
      const slug = useCurrentWorkspaceStore.getState().slug;
      if (!slug) return;
      const data = await apiFetch(`/workspaces/${slug}/channels`);
      set({ channels: data.channels || [] });
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  },

  joinChannel: (channelId) => {
    const socket = socketClient.getSocket();
    socket.emit('join_room', `channel:${channelId}`);
    get().fetchMessages(channelId);
  },

  leaveChannel: () => {
    const socket = socketClient.getSocket();
    const activeChannelId = get().activeChannelId;
    if (activeChannelId) {
      socket.emit('leave_room', `channel:${activeChannelId}`);
    }
    set({ activeChannelId: null });
  },

  fetchMessages: async (channelId: string) => {
    if (get().activeChannelId !== channelId || get().messages.length === 0) {
      set({ isLoading: true, activeChannelId: channelId });
    } else {
      set({ activeChannelId: channelId });
    }
    try {
      const slug = useCurrentWorkspaceStore.getState().slug;
      if (!slug) return;
      const data = await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages`);
      set({ messages: data.messages || [] });
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  searchChannelMessages: async (channelId: string, q: string) => {
    set({ isSearching: true });
    try {
      const slug = useCurrentWorkspaceStore.getState().slug;
      if (!slug) return;
      const data = await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages?q=${encodeURIComponent(q)}`);
      set({ searchResults: data.messages || [] });
    } catch (error) {
      console.error('Failed to search messages:', error);
      set({ searchResults: [] });
    } finally {
      set({ isSearching: false });
    }
  },

  clearSearch: () => {
    set({ isSearching: false, searchResults: [] });
  },

  fetchThreadReplies: async (channelId, parentMessageId) => {
    try {
      const workspaceSlug = useCurrentWorkspaceStore.getState().slug || useWorkspaceStore.getState().currentWorkspace?.slug;
      if (!workspaceSlug) return [];
      const data = await apiFetch(`/workspaces/${workspaceSlug}/channels/${channelId}/messages?threadId=${parentMessageId}`);
      const replies = data.messages || [];
      set((state) => ({
        threads: { ...state.threads, [parentMessageId]: replies },
      }));
      return replies;
    } catch (err) {
      console.error('Error fetching thread replies:', err);
      return [];
    }
  },

  sendMessage: async (channelId, bodyText, threadId = null) => {
    const workspaceSlug = useCurrentWorkspaceStore.getState().slug || useWorkspaceStore.getState().currentWorkspace?.slug;
    if (!workspaceSlug) return;

    await apiFetch(`/workspaces/${workspaceSlug}/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ bodyText, threadId }),
    });

    if (!threadId) {
      await get().fetchMessages(channelId);
    }
  },

  updateMessage: (updatedMsg) => {
    set((state) => {
      const updateMsgList = (list: Message[]) =>
        list.map((m) => (m.messageId === updatedMsg.messageId ? { ...m, ...updatedMsg } : m));

      const newMessages = updateMsgList(state.messages);
      const newThreads: Record<string, Message[]> = {};
      for (const parentId in state.threads) {
        newThreads[parentId] = updateMsgList(state.threads[parentId]);
      }

      return { messages: newMessages, threads: newThreads };
    });
  },

  removeMessage: (messageId) => {
    set((state) => {
      const filterMsgList = (list: Message[]) => list.filter((m) => m.messageId !== messageId);

      const newMessages = filterMsgList(state.messages);
      const newThreads: Record<string, Message[]> = {};
      for (const parentId in state.threads) {
        newThreads[parentId] = filterMsgList(state.threads[parentId]);
      }

      return { messages: newMessages, threads: newThreads };
    });
  },

  addReactionToMessage: (messageId, rx) => {
    set((state) => {
      const updateMsgList = (list: Message[]) =>
        list.map((m) => {
          if (m.messageId !== messageId) return m;
          const currentRx = m.reactions || [];
          const exists = currentRx.some((r) => r.userId === rx.userId && r.emoji === rx.emoji);
          if (exists) return m;
          return {
            ...m,
            reactions: [...currentRx, { messageId, userId: rx.userId, emoji: rx.emoji, userName: rx.userName || 'User' }]
          };
        });

      const newMessages = updateMsgList(state.messages);
      const newThreads: Record<string, Message[]> = {};
      for (const parentId in state.threads) {
        newThreads[parentId] = updateMsgList(state.threads[parentId]);
      }
      return { messages: newMessages, threads: newThreads };
    });
  },

  removeReactionFromMessage: (messageId, rx) => {
    set((state) => {
      const updateMsgList = (list: Message[]) =>
        list.map((m) => {
          if (m.messageId !== messageId) return m;
          const currentRx = m.reactions || [];
          return {
            ...m,
            reactions: currentRx.filter((r) => !(r.userId === rx.userId && r.emoji === rx.emoji))
          };
        });

      const newMessages = updateMsgList(state.messages);
      const newThreads: Record<string, Message[]> = {};
      for (const parentId in state.threads) {
        newThreads[parentId] = updateMsgList(state.threads[parentId]);
      }
      return { messages: newMessages, threads: newThreads };
    });
  },

  uploadFile: async (file: File) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    const slug = workspace?.slug || useCurrentWorkspaceStore.getState().slug;
    
    if (!slug) {
      console.error('No workspace slug found for upload');
      return null;
    }

    try {
      // Convert file to base64 for server-side upload
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data:...;base64, prefix
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload via backend (server-side Supabase upload)
      const data = await apiFetch(`/workspaces/${slug}/files/upload`, {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          mimetype: file.type,
          sizeBytes: file.size,
          filetype: file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('video/') ? 'video' :
                   file.type === 'application/pdf' ? 'pdf' : 'other',
          fileBase64,
        })
      });

      if (!data.fileRecord) throw new Error('No file record created');

      return {
        fileId: data.fileRecord.fileId,
        filename: data.fileRecord.filename
      };
    } catch (err) {
      console.error('File upload failed:', err);
      return null;
    }
  }

}));
