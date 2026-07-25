import { create } from 'zustand';
import { apiFetch } from '../lib/api.js';
import { socketClient } from '../lib/socket.js';

export interface Message {
  messageId: string;
  channelId: string;
  senderId: string;
  bodyText: string; // HTML from Tiptap
  createdAt: string;
  authorName?: string;
  authorAvatar?: string;
  threadId?: string | null;
  threadCount?: number;
  replyCount?: number;
}



interface ChatState {
  messages: Message[];
  isLoading: boolean;
  activeChannelId: string | null;
  joinChannel: (slug: string, channelId: string) => Promise<void>;
  leaveChannel: () => void;
  sendMessage: (slug: string, channelId: string, content: string) => Promise<void>;
  addIncomingMessage: (msg: Message) => void;
  removeMessage: (messageId: string, threadId?: string | null) => void;
}


export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  activeChannelId: null,

  joinChannel: async (slug, channelId) => {
    // If already in this channel, don't re-fetch unnecessarily
    if (get().activeChannelId === channelId) return;

    set({ isLoading: true, activeChannelId: channelId, messages: [] });
    
    // 1. Fetch historical messages
    try {
      const data = await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages`);
      set({ messages: data.messages || [], isLoading: false });
    } catch (err) {
      console.error('Failed to load messages', err);
      set({ isLoading: false });
    }

    // Setup Socket
    const socket = socketClient.getSocket();
    
    // Join the room for this channel
    socket.emit('join_room', `channel:${channelId}`);

    // Listen for new messages
    socket.off('new_message'); // Remove old listeners just in case
    socket.off('message_deleted');
    socket.on('new_message', (msg: Message) => {
      // Only append if it's for the active channel
      if (msg.channelId === get().activeChannelId) {
        get().addIncomingMessage(msg);
      }
    });

    socket.on('message_deleted', ({ messageId, threadId }: { messageId: string; threadId?: string | null }) => {
      get().removeMessage(messageId, threadId);
    });

  },

  leaveChannel: () => {
    const channelId = get().activeChannelId;
    if (channelId) {
      const socket = socketClient.getSocket();
      socket.emit('leave_room', `channel:${channelId}`);
    }
    set({ activeChannelId: null, messages: [] });
  },

  addIncomingMessage: (msg: Message) => {
    set((state) => ({
      // Prevent duplicates in case the sender receives it via socket and HTTP response
      messages: state.messages.some(m => m.messageId === msg.messageId) 
        ? state.messages 
        : [...state.messages, msg]
    }));
  },

  removeMessage: (messageId: string, threadId?: string | null) => {
    set((state) => {
      let updatedMessages = state.messages.filter((m) => m.messageId !== messageId);
      if (threadId) {
        updatedMessages = updatedMessages.map((m) => {
          if (m.messageId === threadId) {
            const currentCount = m.replyCount ?? m.threadCount ?? 0;
            const newCount = Math.max(0, currentCount - 1);
            return { ...m, replyCount: newCount, threadCount: newCount };
          }
          return m;
        });
      }
      return { messages: updatedMessages };
    });
  },



  sendMessage: async (slug, channelId, content) => {
    try {
      const data = await apiFetch(`/workspaces/${slug}/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ bodyText: content }),
      });
      get().addIncomingMessage(data.data);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  },
}));
