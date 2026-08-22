import type { ReactNode } from 'react';

/** Consistent page title block: heading, optional blurb, optional right-side actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-medium text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Standard content well for the screens inside the workspace shell.
 *
 * `narrow` constrains the content but keeps the outer column at the same width
 * as every other page, so a form stays left-aligned with the project tab bar
 * above it instead of drifting toward the centre of the viewport.
 */
export function PageShell({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className={narrow ? 'max-w-2xl' : undefined}>{children}</div>
    </div>
  );
}
