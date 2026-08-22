import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { supabase } from '../../lib/supabase.js';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const GithubCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const exchangeCode = async () => {
      try {
        // Wait for Supabase to parse hash and establish session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        if (!session?.provider_token) {
          throw new Error('No GitHub provider token found in Supabase session.');
        }

        await apiFetch('/github/oauth/exchange', {
          method: 'POST',
          body: JSON.stringify({ providerToken: session.provider_token }),
        });

        const returnTo = searchParams.get('returnTo') || '/workspaces';
        navigate(returnTo, { replace: true });
      } catch (err: unknown) {
        console.error('GitHub OAuth Exchange Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect GitHub account.');
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-background px-4 text-center">
        <div className="bg-danger-muted border border-danger-border text-danger p-6 rounded-lg max-w-md">
          <h2 className="text-heading font-[590] mb-2">GitHub Connection Error</h2>
          <p className="text-ui mb-6">{error}</p>
          <Button
            variant="secondary"
            onClick={() => navigate('/workspaces', { replace: true })}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" strokeWidth={1.5} />
      <h2 className="text-heading font-[590] text-foreground mb-2">Connecting GitHub</h2>
      <p className="text-muted-foreground text-ui">Please wait while we securely link your account...</p>
    </div>
  );
};
