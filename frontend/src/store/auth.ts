import { create } from 'zustand';
import { apiFetch } from '../lib/api.js';

interface User {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  preferences?: {
    notifyOnlyMentions?: boolean;
    muteGithubBot?: boolean;
    mutedChannels?: string[];
    [key: string]: unknown;
  };
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface RegisterCredentials {
  email: string;
  password?: string;
  fullName?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updatePreferences: (prefs: Record<string, unknown>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  // Listen for the global unauthorized event emitted by api.ts
  if (typeof window !== 'undefined') {
    window.addEventListener('auth:unauthorized', () => {
      set({ user: null, isAuthenticated: false });
    });
  }

  return {
    user: null,
    isAuthenticated: false,
    isInitializing: true, // Used to show a loading screen while checking session on mount

    login: async (credentials) => {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      localStorage.setItem('accessToken', data.accessToken);
      set({ user: data.user, isAuthenticated: true });
    },

    register: async (credentials) => {
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      localStorage.setItem('accessToken', data.accessToken);
      set({ user: data.user, isAuthenticated: true });
    },

    logout: async () => {
      try {
        await apiFetch('/auth/logout', { method: 'POST' });
      } catch (err) {
        console.error('Failed to logout gracefully:', err);
      } finally {
        localStorage.removeItem('accessToken');
        set({ user: null, isAuthenticated: false });
      }
    },

    checkAuth: async () => {
      try {
        const data = await apiFetch('/auth/me');
        set({ user: data.user, isAuthenticated: true, isInitializing: false });
      } catch (err) {
        console.error('Check auth error:', err);
        set({ user: null, isAuthenticated: false, isInitializing: false });
      }
    },

    updatePreferences: async (prefs: Record<string, unknown>) => {
      try {
        const data = await apiFetch('/auth/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ preferences: prefs })
        });
        set((state) => ({
          user: state.user ? { ...state.user, preferences: data.preferences } : null
        }));
      } catch (err) {
        console.error('Update preferences error:', err);
        throw err;
      }
    },
  };
});
