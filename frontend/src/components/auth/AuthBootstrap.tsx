import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';
import { AppLoading } from '@/components/layout/AppLoading';

/**
 * Resolves the session exactly once per page load, before any route renders.
 *
 * The check is worth running even with no `accessToken` in localStorage: the
 * refresh token lives in an HTTP-only cookie, so `apiFetch` can still trade it
 * for a fresh access token and recover the session. That is what makes a hard
 * reload survive the 15-minute access-token expiry.
 *
 * The flag is module-level rather than a ref so that StrictMode's double-mount
 * and any later remount of this component cannot re-trigger the request.
 */
let bootstrapStarted = false;

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    void checkAuth();
  }, [checkAuth]);

  if (isInitializing) {
    return <AppLoading />;
  }

  return <>{children}</>;
}
