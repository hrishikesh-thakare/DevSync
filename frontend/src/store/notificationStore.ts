import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type { AppNotification } from '@/types/api';

export type { AppNotification } from '@/types/api';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: AppNotification) => void;
  /**
   * Asks the server where a notification points. The mapping from entity to
   * URL lives in notifications.controller.ts — never rebuild it client-side,
   * or the two drift the moment a route changes.
   */
  resolveUrl: (id: string) => Promise<string>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch('/notifications?limit=100');
      const notifs: AppNotification[] = data.notifications || [];
      const unreadCount = notifs.filter((n) => !n.isRead).length;
      set({ notifications: notifs, unreadCount, isLoading: false });
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load notifications',
        isLoading: false,
      });
    }
  },

  markAsRead: async (id: string) => {
    // Optimistic update
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.notificationId === id && !n.isRead ? { ...n, isRead: true } : n
      );
      const unreadCount = updated.filter((n) => !n.isRead).length;
      return { notifications: updated, unreadCount };
    });

    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
      // Revert optimism if needed (ignoring for simplicity)
    }
  },

  markAllAsRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));

    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  },

  resolveUrl: async (id: string) => {
    const data = await apiFetch(`/notifications/${id}/resolve`);
    return (data?.url as string) || '/workspaces';
  },

  addNotification: (notification: AppNotification) => {
    set((state) => {
      // Avoid duplicates
      if (state.notifications.some(n => n.notificationId === notification.notificationId)) {
        return state;
      }
      const updated = [notification, ...state.notifications];
      const unreadCount = updated.filter((n) => !n.isRead).length;
      return { notifications: updated, unreadCount };
    });
  },
}));
