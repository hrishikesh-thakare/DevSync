import type { ReactNode } from 'react';
import { TriangleAlertIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * The three states every list screen needs, in one place.
 *
 * These were previously ad hoc: ten screens used the designed `<Empty>`
 * component while roughly fourteen fell back to a centred grey `<p>`, seven had
 * no loading treatment at all (one rendered `null`, i.e. a blank page), and
 * eight failed silently or via a toast that vanishes. Routing them through
 * shared helpers is what stops that drifting apart again.
 *
 * Note what this module is and is not. It is a kit of *shape-specific*
 * primitives, not a wrapper to be applied uniformly — the skeleton has to match
 * the layout it stands in for, or it trades one kind of jank for another. So
 * when a screen has a shape the kit does not cover, the fix is to add the shape
 * here (see `BoardSkeleton`, `MessageSkeleton`, both lifted from the pages that
 * originally hand-rolled them), never to force that screen onto a shape that
 * does not fit it.
 *
 * `EmptyState` and `ErrorState`, by contrast, do apply everywhere: a failed
 * load and an empty result look the same on every screen in the product.
 *
 * Two things deliberately stay outside this module:
 *
 *  - **Inline form/submit errors** — a rejected password change, a duplicate
 *    project key, a dialog that could not save. Those belong beside the field
 *    that caused them and are the form's business, not the page's. They keep
 *    their own `<Alert>` (see `AuthErrorAlert`, `CreateTaskDialog`).
 *  - **Micro-affordances** — the "Drop a card here" hint in an empty Kanban
 *    column, "No labels yet" inside a 14rem popover. A bordered empty state
 *    with an icon and two lines of copy is heavier than the surface it sits in.
 *
 * The distinction that matters: `ErrorState` means *this region failed to
 * load*. If the request succeeded and the answer was "no" — a permission
 * boundary, say — that is an `EmptyState`, not a destructive alert.
 */

/** Designed empty state. Prefer this over a bare paragraph of muted text. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Empty className={cn(!compact && 'rounded-2xl border', compact && 'py-8', className)}>
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/**
 * Inline error banner.
 *
 * A toast is the wrong tool for a failed *load* — it disappears and leaves the
 * screen looking merely empty, which reads as "there is nothing here" rather
 * than "this did not load".
 */
export function ErrorState({
  message,
  description,
  action,
  className,
}: {
  message: string;
  /** Why it happened or what to do next, when the message alone leaves that unclear. */
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <TriangleAlertIcon className="size-4" aria-hidden="true" />
      <AlertTitle>{message}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </Alert>
  );
}

/** Skeleton shaped like a table body, matching the two members screens. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-36 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton shaped like the Kanban board: a title, then status columns.
 *
 * Lifted out of BoardPage rather than replaced with a generic row stack. A
 * skeleton earns its keep by matching the layout it stands in for — that is
 * what suppresses the layout shift when real content arrives — so the fix for
 * the board was never to make it generic, it was to make its shape reusable.
 */
export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div aria-hidden="true">
      <Skeleton className="mb-4 h-9 w-72 rounded-lg" />
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton shaped like a channel transcript: a header, then message rows. */
export function MessageSkeleton({ messages = 5 }: { messages?: number }) {
  return (
    <div aria-hidden="true">
      <Skeleton className="mb-4 h-8 w-64 rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: messages }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
