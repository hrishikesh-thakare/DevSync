import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { Button } from '@/components/ui/button';

type VerifyState = 'verifying' | 'verified' | 'error';

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [state, setState] = useState<VerifyState>(token ? 'verifying' : 'error');
  const [error, setError] = useState(
    token ? '' : 'This verification link is invalid. Please use the link from your email.'
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        await apiFetch('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        if (!cancelled) setState('verified');
      } catch (err: unknown) {
        if (!cancelled) {
          setState('error');
          setError(err instanceof Error ? err.message : 'Failed to verify your email.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="auth-shape-1"></div>
      <div className="auth-shape-2"></div>

      <div className="bg-card border border-border rounded-lg shadow-sm max-w-[400px] w-full p-8 animate-fadeIn relative z-[var(--z-sticky)] text-center">
        <div className="mb-8">
          <h1 className="text-heading font-[590] text-foreground mb-2">DevSync</h1>
          <p className="text-muted-foreground text-ui">Email verification</p>
        </div>

        {state === 'verifying' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" strokeWidth={1.5} />
            <p className="text-muted-foreground text-ui">Verifying your email address…</p>
          </div>
        )}

        {state === 'verified' && (
          <div className="space-y-6 py-2">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-success" strokeWidth={1.5} />
            </div>
            <p className="text-foreground">
              Your email has been <strong className="text-success">verified</strong> successfully.
            </p>
            <Button asChild variant="primary" className="w-full py-3 text-center h-auto">
              <Link to="/login" className="inline-block bg-primary text-primary-foreground hover:bg-primary-hover rounded-md w-full py-3 text-center">
                Go to sign in
              </Link>
            </Button>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-6 py-2">
            <div className="flex justify-center">
              {token ? (
                <XCircle className="h-16 w-16 text-danger" strokeWidth={1.5} />
              ) : (
                <AlertTriangle className="h-16 w-16 text-warning" strokeWidth={1.5} />
              )}
            </div>
            <p className="text-foreground">{error || 'Verification failed.'}</p>
            <Button asChild variant="primary" className="w-full py-3 text-center h-auto">
              <Link to="/login" className="inline-block bg-primary text-primary-foreground hover:bg-primary-hover rounded-md w-full py-3 text-center">
                Back to sign in
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
