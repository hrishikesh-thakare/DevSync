import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { apiFetch } from '../../lib/api.js';
import { useAuthStore } from '../../store/auth.js';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const { checkAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      try {
        // 1. Get the session from Supabase JS client (it auto-parses the URL hash)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        if (!session?.access_token) throw new Error('No access token found in session');

        // 2. Exchange the Supabase access_token with our Backend
        // This will create the user in our custom database and issue an HTTP-only cookie
        const response = await apiFetch('/auth/oauth/callback', {
          method: 'POST',
          body: JSON.stringify({
            provider: session.user.app_metadata.provider || 'github',
            providerToken: session.access_token,
          }),
        });

        localStorage.setItem('accessToken', response.accessToken);

        // 3. Update Zustand store
        await checkAuth();

        // 4. Redirect into the app
        navigate('/workspaces', { replace: true });
        
      } catch (err: unknown) {
        console.error('OAuth Callback Error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
      }
    };

    handleOAuthRedirect();
  }, [navigate, checkAuth]);

  if (error) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center bg-background px-4 text-center">
        <div className="bg-danger-muted border border-danger-border text-danger p-6 rounded-lg max-w-[400px]">
          <h2 className="text-heading font-[590] mb-2">Authentication Error</h2>
          <p className="text-ui mb-6">{error}</p>
          <Button
            variant="secondary"
            onClick={() => navigate('/login', { replace: true })}
          >
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" strokeWidth={1.5} />
      <h2 className="text-heading font-[590] text-foreground mb-2">Authenticating</h2>
      <p className="text-muted-foreground text-ui">Securely connecting your account...</p>
    </div>
  );
};
