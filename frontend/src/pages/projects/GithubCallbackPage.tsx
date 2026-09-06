import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { apiFetch } from '@/lib/api';
import { AppLoading } from '@/components/layout/AppLoading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Landing point for GitHub's OAuth redirect after a user links their GitHub
 * account (triggered from GitHubIntegration.tsx's "Connect GitHub account").
 * This is a project-integration concern, not a DevSync login — the user is
 * already authenticated; this page just exchanges the `code` GitHub handed
 * back for a real access token (server-side, via /github/oauth/exchange) and
 * returns to wherever the flow started.
 */
export function GithubCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const ranRef = useRef(false);

  // Computed synchronously from the URL, not via state — GitHub's own error
  // params and a missing code/state need no async work to detect.
  const githubError = params.get('error');
  const code = params.get('code');
  const state = params.get('state');
  const upfrontError = githubError
    ? params.get('error_description') ||
      (githubError === 'access_denied'
        ? 'You declined the GitHub authorization request.'
        : 'GitHub sign-in was cancelled.')
    : !code || !state
      ? 'Missing authorization code from GitHub. Please try connecting again.'
      : null;

  useEffect(() => {
    // StrictMode double-invokes effects in dev; the code GitHub issued is
    // single-use, so a second exchange attempt would just fail confusingly.
    if (ranRef.current || upfrontError || !code || !state) return;
    ranRef.current = true;

    void (async () => {
      try {
        const data = await apiFetch('/github/oauth/exchange', {
          method: 'POST',
          body: JSON.stringify({ code, state }),
        });
        navigate(data.returnTo || '/workspaces', { replace: true });
      } catch (err) {
        setExchangeError(err instanceof Error ? err.message : 'Could not finish linking your GitHub account.');
      }
    })();
  }, [upfrontError, code, state, navigate]);

  const error = upfrontError || exchangeError;

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>GitHub sign-in could not be completed</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/workspaces', { replace: true })}>
              Back to DevSync
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AppLoading label="Linking your GitHub account" />;
}
