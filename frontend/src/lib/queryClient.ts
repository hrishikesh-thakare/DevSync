import { QueryClient } from '@tanstack/react-query';

/**
 * Single shared instance. `App.tsx` hands this to `QueryClientProvider`, but
 * code outside the component tree needs it too — `taskDetailStore` and
 * `labelStore` patch the cached task list directly (see `queries/tasks.ts`)
 * the same way they used to call `useTaskStore.setState`. Importing a
 * module-level singleton is how both sides reach the same cache without one
 * depending on React context.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});
