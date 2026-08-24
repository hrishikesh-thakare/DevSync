import { create } from 'zustand';
import { apiFetch, ApiError } from '@/lib/api';

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
  /**
   * Present only when arriving from an invite email, which links to
   * `/register?inviteToken=…`. The server redeems it inside the same
   * transaction that creates the user, and rejects it unless `email` matches
   * the invited address.
   */
  inviteToken?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  loginWithOAuth: (providerToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updatePreferences: (prefs: Record<string, unknown>) => Promise<void>;
  updateAvatar: (avatarUrl: string | null) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  // Listen for the global unauthorized event emitted by api.ts
  if (typeof window !== 'undefined') {
    window.addEventListener('auth:unauthorized', () => {
      // Drop the dead token too, otherwise every later request re-runs the
      // refresh dance against a session the server has already rejected.
      localStorage.removeItem('accessToken');
      set({ user: null, isAuthenticated: false, isInitializing: false });
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

    // Trades a Supabase session for an app JWT. Supabase owns the provider
    // handshake; the backend verifies that token, upserts the local user row,
    // and issues its own access + refresh pair.
    loginWithOAuth: async (providerToken) => {
      const data = await apiFetch('/auth/oauth/callback', {
        method: 'POST',
        body: JSON.stringify({ providerToken }),
      });
      localStorage.setItem('accessToken', data.accessToken);
      set({ user: data.user, isAuthenticated: true, isInitializing: false });
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
        // A 401 here just means "nobody is signed in" — the expected answer
        // for a logged-out visitor, not a fault worth logging. Anything else
        // (network down, 500) is a real problem and stays visible.
        if (!(err instanceof ApiError) || err.status !== 401) {
          console.error('Check auth error:', err);
        }
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

    // The image itself is already uploaded to Supabase storage by the caller
    // (same bucket the message composer's attachments use) by the time this
    // runs — this just hands the server the resulting public URL to persist.
    updateAvatar: async (avatarUrl: string | null) => {
      const data = await apiFetch('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl }),
      });
      set((state) => (state.user ? { user: { ...state.user, avatarUrl: data.avatarUrl } } : {}));
    },
  };
});
