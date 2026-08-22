import { cn } from "@/lib/utils"

/* ── Skeletons (§8 Loading) ──────────────────────────────────────
   "Skeletons for layout you can predict, spinners for actions you cannot."
   "Whole-page first load | Skeleton, not a centred spinner."

   Every skeleton here is decorative — the surrounding region carries the
   `aria-busy` / status text — so each root is `aria-hidden`.

   Callers must gate these behind `useDelayedFlag(isLoading)`: §8 requires a
   200ms delay, because a skeleton that flashes for 80ms is worse than none. */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />
}

/** The workspace shell: 240px sidebar + 56px top bar + content. */
export function AppShellSkeleton() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background" aria-hidden="true">
      <div className="hidden lg:flex w-[240px] flex-col gap-2 border-r border-border bg-card p-3">
        <Skeleton className="h-8 w-full" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="h-14 border-b border-border bg-card px-6 flex items-center">
          <Skeleton className="h-8 w-full max-w-md" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Kanban: four fixed columns of cards. */
export function BoardSkeleton() {
  return (
    <div className="flex h-full gap-3 overflow-hidden p-6" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, col) => (
        <div key={col} className="flex w-72 shrink-0 flex-col gap-2">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: 3 }).map((_, card) => (
            <Skeleton key={card} className="h-24 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** A generic list/table body — rows matching the real row height. */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}
