import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, Loader2Icon, OctagonXIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { AuthShell } from '@/pages/auth/AuthShell';

type Outcome = { state: 'verifying' } | { state: 'ok' } | { state: 'failed'; message: string };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [outcome, setOutcome] = useState<Outcome>(
    token ? { state: 'verifying' } : { state: 'failed', message: 'No verification token in the address.' },
  );

  // The token is single-use: the second POST is answered 400 and would turn a
  // success into a failure on screen. StrictMode runs effects twice on mount
  // and preserves refs across that, so this is what stops the double-spend.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    void (async () => {
      try {
        await apiFetch('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        setOutcome({ state: 'ok' });
      } catch (err) {
        setOutcome({
          state: 'failed',
          message: err instanceof Error ? err.message : 'Could not verify this email address.',
        });
      }
    })();
  }, [token]);

  if (outcome.state === 'verifying') {
    return (
      <AuthShell title="Verifying your email" description="This only takes a moment.">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          <span role="status">Checking your verification link…</span>
        </div>
      </AuthShell>
    );
  }

  if (outcome.state === 'ok') {
    return (
      <AuthShell title="Email verified" description="Your address is confirmed.">
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Email verified successfully</AlertTitle>
          <AlertDescription>You have full access to your workspaces now.</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link to={isAuthenticated ? '/workspaces' : '/login'}>
            {isAuthenticated ? 'Go to your workspaces' : 'Go to sign in'}
          </Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verification failed"
      description="This link cannot be used."
      footer={
        <Link to="/login" className="text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      <Alert variant="destructive">
        <OctagonXIcon />
        <AlertTitle>{outcome.message}</AlertTitle>
        <AlertDescription>
          Verification links expire and work only once. Signing in again sends a fresh one.
        </AlertDescription>
      </Alert>
    </AuthShell>
  );
}
