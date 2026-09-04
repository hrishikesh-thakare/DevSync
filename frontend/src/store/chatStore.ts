import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { Channel, ChannelMember, ChatMessage } from '@/types/api';

export interface ChatAttachmentInput {
  name: string;
  url?: string;
  sizeBytes: number;
  mimetype: string;
}

interface ChatState {
  channel: Channel | null;
  members: ChannelMember[];
  messages: ChatMessage[];
  /** Replies for the thread currently open in the side panel. */
  threadRoot: ChatMessage | null;
  threadReplies: ChatMessage[];
  isLoading: boolean;
  isThreadLoading: boolean;
  error: string | null;

  openChannel: (slug: string, channelId: string) => Promise<void>;
  send: (slug: string, channelId: string, bodyText: string, threadId?: string | null, attachments?: ChatAttachmentInput[]) => Promise<void>;
  edit: (slug: string, channelId: string, messageId: string, bodyText: string) => Promise<void>;
  remove: (slug: string, channelId: string, messageId: string) => Promise<void>;
  react: (slug: string, channelId: string, messageId: string, emoji: string, on: boolean) => Promise<void>;

  openThread: (slug: string, channelId: string, root: ChatMessage) => Promise<void>;
  closeThread: () => void;

  // ── socket handlers ──
  onNewMessage: (message: ChatMessage) => void;
  onMessageUpdated: (message: ChatMessage) => void;
  onMessageDeleted: (payload: { messageId: string; threadId?: string | null }) => void;
  onReactionAdded: (payload: { messageId: string; userId: string; emoji: string; userName?: string }) => void;
  onReactionRemoved: (payload: { messageId: string; userId: string; emoji: string }) => void;

  reset: () => void;
}

const base = (slug: string, channelId: string) => `/workspaces/${slug}/channels/${channelId}`;

export const useChatStore = create<ChatState>((set) => ({
  channel: null,
  members: [],
  messages: [],
  threadRoot: null,
  threadReplies: [],
  isLoading: true,
  isThreadLoading: false,
  error: null,

  openChannel: async (slug, channelId) => {
    set({ isLoading: true, error: null, threadRoot: null, threadReplies: [] });
    try {
      const [meta, list] = await Promise.all([
        apiFetch(base(slug, channelId)),
        apiFetch(`${base(slug, channelId)}/messages?limit=100`),
      ]);
      set({
        channel: meta.channel,
        members: meta.members ?? [],
        // The list endpoint already returns oldest-first.
        messages: list.messages ?? [],
        isLoading: false,
      });
    } catch (err) {
      set({
        channel: null,
        messages: [],
        error: err instanceof Error ? err.message : 'Could not open this channel.',
        isLoading: false,
      });
    }
  },

  send: async (slug, channelId, bodyText, threadId = null, attachments = []) => {
    const bodyBlocks = attachments.length > 0 ? attachments.map(att => ({ type: 'attachment', ...att })) : undefined;
    
    const payload: Record<string, unknown> = {};
    if (bodyText) payload.bodyText = bodyText;
    if (bodyBlocks) payload.bodyBlocks = bodyBlocks;
    if (threadId) payload.threadId = threadId;

    // Optimistic insert
    const { useAuthStore } = await import('@/store/auth');
    const me = useAuthStore.getState().user;
    const tempId = `optimistic-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      messageId: tempId,
      channelId,
      threadId,
      authorId: me?.userId ?? null,
      authorName: me?.fullName ?? 'Me',
      authorAvatar: me?.avatarUrl ?? null,
      bodyText: bodyText || '',
      bodyBlocks: bodyBlocks || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSystem: false,
      isEdited: false,
      replyCount: 0,
      reactions: [],
      // We can use the 'optimistic-' prefix in the UI to style it as sending
    };

    set((state) => {
      if (threadId) {
        if (state.threadRoot?.messageId === threadId) {
          return { threadReplies: [...state.threadReplies, optimisticMsg] };
        }
        return {
          messages: state.messages.map((m) =>
            m.messageId === threadId ? { ...m, replyCount: m.replyCount + 1 } : m,
          ),
        };
      }
      return { messages: [...state.messages, optimisticMsg] };
    });

    try {
      const response = await apiFetch(`${base(slug, channelId)}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const realMsg = response.data as ChatMessage;

      set((state) => {
        // If the socket beat us, just clean up the optimistic duplicate
        const socketBeatUs = 
          state.messages.some((m) => m.messageId === realMsg.messageId) || 
          state.threadReplies.some((m) => m.messageId === realMsg.messageId);

        if (socketBeatUs) {
          return {
            messages: state.messages.filter((m) => m.messageId !== tempId),
            threadReplies: state.threadReplies.filter((m) => m.messageId !== tempId),
          };
        } else {
          // Otherwise, upgrade the optimistic message to the real one
          return {
            messages: state.messages.map((m) => (m.messageId === tempId ? realMsg : m)),
            threadReplies: state.threadReplies.map((m) => (m.messageId === tempId ? realMsg : m)),
          };
        }
      });
    } catch (err) {
      // Revert on failure
      set((state) => ({
        messages: state.messages.filter((m) => m.messageId !== tempId),
        threadReplies: state.threadReplies.filter((m) => m.messageId !== tempId),
      }));
      throw err;
    }
  },

  edit: async (slug, channelId, messageId, bodyText) => {
    await apiFetch(`${base(slug, channelId)}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ bodyText }),
    });
  },

  remove: async (slug, channelId, messageId) => {
    await apiFetch(`${base(slug, channelId)}/messages/${messageId}`, { method: 'DELETE' });
  },

  react: async (slug, channelId, messageId, emoji, on) => {
    const url = `${base(slug, channelId)}/messages/${messageId}/reactions`;
    if (on) {
      await apiFetch(url, { method: 'POST', body: JSON.stringify({ emoji }) });
    } else {
      await apiFetch(`${url}/${encodeURIComponent(emoji)}`, { method: 'DELETE' });
    }
  },

  openThread: async (slug, channelId, root) => {
    set({ threadRoot: root, threadReplies: [], isThreadLoading: true });
    try {
      const data = await apiFetch(`${base(slug, channelId)}/messages/${root.messageId}/thread`);
      set({ threadReplies: data.replies ?? [], isThreadLoading: false });
    } catch {
      set({ threadReplies: [], isThreadLoading: false });
    }
  },

  closeThread: () => set({ threadRoot: null, threadReplies: [] }),

  onNewMessage: (message) => {
    set((state) => {
      if (state.channel && message.threadId && state.threadRoot?.messageId === message.threadId) {
        // A reply to the open thread.
        if (state.threadReplies.some((m) => m.messageId === message.messageId)) return state;
        return { threadReplies: [...state.threadReplies, message] };
      }
      if (message.threadId) {
        // A reply to some other thread: only bump its reply count.
        return {
          messages: state.messages.map((m) =>
            m.messageId === message.threadId ? { ...m, replyCount: m.replyCount + 1 } : m,
          ),
        };
      }
      if (state.messages.some((m) => m.messageId === message.messageId)) return state;
      return { messages: [...state.messages, message] };
    });
  },

  onMessageUpdated: (message) => {
    set((state) => ({
      messages: state.messages.map((m) => (m.messageId === message.messageId ? { ...m, ...message } : m)),
      threadReplies: state.threadReplies.map((m) =>
        m.messageId === message.messageId ? { ...m, ...message } : m,
      ),
    }));
  },

  onMessageDeleted: ({ messageId }) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.messageId !== messageId),
      threadReplies: state.threadReplies.filter((m) => m.messageId !== messageId),
      threadRoot: state.threadRoot?.messageId === messageId ? null : state.threadRoot,
    }));
  },

  onReactionAdded: ({ messageId, userId, emoji, userName }) => {
    const add = (m: ChatMessage) =>
      m.messageId === messageId &&
      !m.reactions.some((r) => r.userId === userId && r.emoji === emoji)
        ? { ...m, reactions: [...m.reactions, { messageId, userId, emoji, userName: userName ?? null }] }
        : m;
    set((state) => ({
      messages: state.messages.map(add),
      threadReplies: state.threadReplies.map(add),
    }));
  },

  onReactionRemoved: ({ messageId, userId, emoji }) => {
    const strip = (m: ChatMessage) =>
      m.messageId === messageId
        ? { ...m, reactions: m.reactions.filter((r) => !(r.userId === userId && r.emoji === emoji)) }
        : m;
    set((state) => ({
      messages: state.messages.map(strip),
      threadReplies: state.threadReplies.map(strip),
    }));
  },

  reset: () =>
    set({
      channel: null,
      members: [],
      messages: [],
      threadRoot: null,
      threadReplies: [],
      isLoading: true,
      error: null,
    }),
}));

export type { ChatMessage } from '@/types/api';
