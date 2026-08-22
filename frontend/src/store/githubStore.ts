import { create } from 'zustand';
import { apiFetch } from '@/lib/api';
import type {
  GithubBranch,
  GithubCiRun,
  GithubCommit,
  GithubConnection,
  GithubIssue,
  GithubPullRequest,
} from '@/types/api';

export type GithubTab = 'commits' | 'ci' | 'prs' | 'issues' | 'branches';

interface Paged<T> {
  items: T[];
  totalCount: number;
  page: number;
  totalPages: number;
}

const emptyPage = <T,>(): Paged<T> => ({ items: [], totalCount: 0, page: 1, totalPages: 1 });

interface GithubState {
  connection: GithubConnection | null;
  /** Branch names the server extracts from commit/CI history, for the filters. */
  branchOptions: string[];
  isLoadingConnection: boolean;
  connectionError: string | null;

  commits: Paged<GithubCommit>;
  ciRuns: Paged<GithubCiRun>;
  pullRequests: Paged<GithubPullRequest>;
  issues: Paged<GithubIssue>;
  branches: GithubBranch[];
  isLoadingTab: boolean;
  tabError: string | null;

  fetchConnection: (slug: string, key: string) => Promise<void>;
  connect: (slug: string, key: string, owner: string, name: string) => Promise<void>;
  disconnect: (slug: string, key: string) => Promise<void>;
  fetchTab: (slug: string, key: string, tab: GithubTab, opts?: { page?: number; branch?: string; state?: string }) => Promise<void>;
  rerun: (slug: string, key: string, runId: number) => Promise<void>;
  reset: () => void;
}

const base = (slug: string, key: string) => `/workspaces/${slug}/projects/${key}/github`;

export const useGithubStore = create<GithubState>((set) => ({
  connection: null,
  branchOptions: [],
  isLoadingConnection: true,
  connectionError: null,

  commits: emptyPage(),
  ciRuns: emptyPage(),
  pullRequests: emptyPage(),
  issues: emptyPage(),
  branches: [],
  isLoadingTab: false,
  tabError: null,

  fetchConnection: async (slug, key) => {
    set({ isLoadingConnection: true, connectionError: null });
    try {
      const data = await apiFetch(`${base(slug, key)}/connection`);
      set({ connection: data.connection ?? null, isLoadingConnection: false });
    } catch (err) {
      set({
        connection: null,
        connectionError: err instanceof Error ? err.message : 'Could not read the GitHub connection.',
        isLoadingConnection: false,
      });
    }
  },

  connect: async (slug, key, owner, name) => {
    // The schema is .strict() and uses snake_case here, unlike every other
    // endpoint in the API.
    const data = await apiFetch(`${base(slug, key)}/connect`, {
      method: 'POST',
      body: JSON.stringify({ repo_owner: owner, repo_name: name }),
    });
    set({ connection: data.connection });
  },

  disconnect: async (slug, key) => {
    await apiFetch(`${base(slug, key)}/disconnect`, { method: 'DELETE' });
    set({
      connection: null,
      commits: emptyPage(),
      ciRuns: emptyPage(),
      pullRequests: emptyPage(),
      issues: emptyPage(),
      branches: [],
    });
  },

  fetchTab: async (slug, key, tab, opts = {}) => {
    set({ isLoadingTab: true, tabError: null });
    const page = opts.page ?? 1;
    const branch = opts.branch && opts.branch !== 'all' ? `&branch=${encodeURIComponent(opts.branch)}` : '';
    const state = opts.state && opts.state !== 'all' ? `&state=${encodeURIComponent(opts.state)}` : '';

    try {
      if (tab === 'commits') {
        const d = await apiFetch(`${base(slug, key)}/commits?page=${page}&limit=25${branch}`);
        set({
          commits: { items: d.commits ?? [], totalCount: d.totalCount ?? 0, page: d.page ?? 1, totalPages: d.totalPages ?? 1 },
          branchOptions: d.branches ?? [],
        });
      } else if (tab === 'ci') {
        const d = await apiFetch(`${base(slug, key)}/ci?page=${page}&limit=25${branch}`);
        set({
          ciRuns: { items: d.runs ?? [], totalCount: d.totalCount ?? 0, page: d.page ?? 1, totalPages: d.totalPages ?? 1 },
          branchOptions: d.branches ?? [],
        });
      } else if (tab === 'prs') {
        const d = await apiFetch(`${base(slug, key)}/pull-requests?page=${page}&limit=25${state}`);
        set({
          pullRequests: {
            items: d.pullRequests ?? [],
            totalCount: d.totalCount ?? 0,
            page: d.page ?? 1,
            totalPages: d.totalPages ?? 1,
          },
        });
      } else if (tab === 'issues') {
        const d = await apiFetch(`${base(slug, key)}/issues?page=${page}&limit=25${state}`);
        set({
          issues: { items: d.issues ?? [], totalCount: d.totalCount ?? 0, page: d.page ?? 1, totalPages: d.totalPages ?? 1 },
        });
      } else {
        const d = await apiFetch(`${base(slug, key)}/branches`);
        set({ branches: d.branches ?? [] });
      }
      set({ isLoadingTab: false });
    } catch (err) {
      set({
        tabError: err instanceof Error ? err.message : 'Could not load GitHub data.',
        isLoadingTab: false,
      });
    }
  },

  rerun: async (slug, key, runId) => {
    await apiFetch(`${base(slug, key)}/ci/${runId}/rerun`, { method: 'POST' });
  },

  reset: () =>
    set({
      connection: null,
      branchOptions: [],
      isLoadingConnection: true,
      connectionError: null,
      commits: emptyPage(),
      ciRuns: emptyPage(),
      pullRequests: emptyPage(),
      issues: emptyPage(),
      branches: [],
      tabError: null,
    }),
}));
