import { create } from 'zustand';
import { apiFetch } from '../lib/api';
import { useWorkspaceStore } from './workspaceStore';

import { useCurrentWorkspaceStore } from './currentWorkspace.js';

interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private' | 'dm';
}

interface Message {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
  replyCount: number;
  threadId: string | null;
}

interface ChatState {
  channels: Channel[];
  activeChannel: Channel | null;
  messages: Message[];
  threads: Record<string, Message[]>;
  isLoading: boolean;
  fetchChannels: () => Promise<void>;
  setActiveChannel: (id: string) => void;
  fetchMessages: (channelId: string) => Promise<void>;
  fetchThreadReplies: (channelId: string, messageId: string) => Promise<void>;
  sendMessage: (channelId: string, body: string, threadId?: string) => Promise<void>;
  uploadFile: (file: File) => Promise<{ fileId: string, filename: string } | null>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  channels: [],
  activeChannel: null,
  messages: [],
  threads: {},
  isLoading: false,

  fetchChannels: async () => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    if (!workspace) return;

    set({ isLoading: true });
    try {
      const data = await apiFetch(`/workspaces/${workspace.slug}/channels`);
      
      const mappedChannels = data.channels.map((c: any) => ({
        id: c.channelId,
        name: c.name,
        type: c.type || 'public'
      }));

      set({ channels: mappedChannels, isLoading: false });
      
      if (mappedChannels.length > 0 && !get().activeChannel) {
        set({ activeChannel: mappedChannels[0] });
        get().fetchMessages(mappedChannels[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
      set({ isLoading: false });
    }
  },

  setActiveChannel: (id) => {
    const channel = get().channels.find(c => c.id === id);
    if (channel) {
      set({ activeChannel: channel });
      get().fetchMessages(id);
    }
  },

  fetchMessages: async (channelId) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    if (!workspace) return;

    try {
      const data = await apiFetch(`/workspaces/${workspace.slug}/channels/${channelId}/messages`);
      const mapped = data.messages.map((m: any) => ({
        id: m.messageId,
        channelId: m.channelId,
        senderId: m.authorId || m.senderId,
        body: m.bodyText || '',
        createdAt: m.createdAt,
        replyCount: m.replyCount || 0,
        threadId: m.threadId || null
      }));
      set({ messages: mapped });
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  },

  fetchThreadReplies: async (channelId, messageId) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    if (!workspace) return;

    try {
      const data = await apiFetch(`/workspaces/${workspace.slug}/channels/${channelId}/messages/${messageId}/thread`);
      const mapped = data.replies.map((m: any) => ({
        id: m.messageId,
        channelId: channelId,
        senderId: m.authorId || m.senderId,
        body: m.bodyText || '',
        createdAt: m.createdAt,
        replyCount: 0,
        threadId: m.threadId || messageId
      }));
      
      set((state) => ({
        threads: {
          ...state.threads,
          [messageId]: mapped
        }
      }));
    } catch (err) {
      console.error('Failed to fetch thread replies:', err);
    }
  },

  sendMessage: async (channelId, body, threadId) => {
    const workspace = useWorkspaceStore.getState().currentWorkspace;
    if (!workspace) return;

    try {
      await apiFetch(`/workspaces/${workspace.slug}/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ bodyText: body, threadId }),
      });
      // Re-fetch messages or let websockets handle it
      if (threadId) {
        get().fetchThreadReplies(channelId, threadId);
        get().fetchMessages(channelId); // Update parent reply count
      } else {
        get().fetchMessages(channelId);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
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
