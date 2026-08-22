import { Loader2Icon } from 'lucide-react';

/**
 * Full-viewport hold shown while the session is being resolved. Deliberately a
 * spinner rather than a page skeleton: at this point we do not yet know which
 * page the user is headed to, so there is no layout to approximate.
 */
export function AppLoading({ label = 'Loading DevSync' }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background">
      <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground" role="status">
        {label}
      </p>
    </div>
  );
}
