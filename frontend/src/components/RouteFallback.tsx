import { Loader2 } from 'lucide-react';

/**
 * Shown while a route's chunk is in flight.
 *
 * Deliberately quiet: on a warm cache these chunks resolve in a few
 * milliseconds, and a spinner that flashes in and out on every navigation reads
 * as jank. The 200ms delay before it fades in means a fast load shows nothing
 * at all, and only a genuinely slow one gets an indicator.
 */
export function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="text-muted-foreground route-fallback-spinner size-5" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
      <style>{`
        .route-fallback-spinner {
          opacity: 0;
          animation: route-fallback-in 120ms linear 200ms forwards, route-fallback-spin 1s linear infinite;
        }
        @keyframes route-fallback-in { to { opacity: 1 } }
        @keyframes route-fallback-spin { to { transform: rotate(360deg) } }
        @media (prefers-reduced-motion: reduce) {
          .route-fallback-spinner {
            animation: route-fallback-in 120ms linear 200ms forwards;
          }
        }
      `}</style>
    </div>
  );
}
