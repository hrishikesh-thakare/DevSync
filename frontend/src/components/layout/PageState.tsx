import type { ReactNode } from 'react';
import { TriangleAlertIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
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
  action,
  className,
}: {
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <TriangleAlertIcon className="size-4" aria-hidden="true" />
      <AlertTitle>{message}</AlertTitle>
      {action ? <div className="mt-3">{action}</div> : null}
    </Alert>
  );
}

/** Skeleton rows shaped like a list, rather than one undifferentiated block. */
export function ListSkeleton({
  rows = 5,
  className,
  rowClassName,
}: {
  rows?: number;
  className?: string;
  rowClassName?: string;
}) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('h-14 w-full rounded-xl', rowClassName)} />
      ))}
    </div>
  );
}

/** Skeleton shaped like a table body, matching the two members screens. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40 rounded" />
            <Skeleton className="h-3 w-56 rounded" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Card-grid skeleton, for the project and workspace pickers. */
export function CardGridSkeleton({ cards = 6, className }: { cards?: number; className?: string }) {
  return (
    <div
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
      aria-hidden="true"
    >
      {Array.from({ length: cards }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
  );
}
