import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { WorkspaceSummary } from '@/types/api';

export type { WorkspaceSummary } from '@/types/api';

export interface CreateWorkspaceInput {
  name: string;
  slug?: string;
  description?: string;
}

export const workspaceKeys = {
  all: ['workspaces'] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: async () => {
      const data = await apiFetch('/workspaces');
      return (data.workspaces ?? []) as WorkspaceSummary[];
    },
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput) => {
      const body: CreateWorkspaceInput = { name: input.name };
      if (input.slug) body.slug = input.slug;
      if (input.description) body.description = input.description;

      const data = await apiFetch('/workspaces', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const created: WorkspaceSummary = {
        ...data.workspace,
        role: 'owner',
        state: 'active',
        joinedAt: data.workspace.createdAt,
      };
      return created;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<WorkspaceSummary[]>(workspaceKeys.all, (old) => {
        return old ? [...old, created] : [created];
      });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      await apiFetch(`/workspaces/${slug}/invites/accept`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}
