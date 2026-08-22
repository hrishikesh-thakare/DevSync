import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { AppLoading } from '@/components/layout/AppLoading';
import { AuthShell } from '@/pages/auth/AuthShell';
import { AuthErrorAlert } from '@/pages/auth/AuthErrorAlert';
import { Button } from '@/components/ui/button';

/**
 * Landing point for the Supabase OAuth redirect.
 *
 * supabase-js parses the session out of the URL fragment on load, but that
 * happens asynchronously — so we ask for the session once and, if it is not
 * there yet, wait for the `SIGNED_IN` event rather than declaring failure.
 */
export function OAuthCallbackPage() {
  const loginWithOAuth = useAuthStore((s) => s.loginWithOAuth);
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    const exchange = async (providerToken: string) => {
      try {
        await loginWithOAuth(providerToken);
        if (!cancelled) navigate('/workspaces', { replace: true });
      } catch (err) {
        if (!cancelled) setError(err);
      }
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && !cancelled) {
        void exchange(session.access_token);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return;
      if (sessionError) {
        setError(sessionError);
        return;
      }
      if (data.session?.access_token) {
        void exchange(data.session.access_token);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loginWithOAuth, navigate]);

  if (error) {
    return (
      <AuthShell title="Sign-in could not be completed">
        <AuthErrorAlert error={error} />
        <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
          Back to sign in
        </Button>
      </AuthShell>
    );
  }

  return <AppLoading label="Completing sign-in" />;
}
