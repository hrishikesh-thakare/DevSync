import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { Mail, Lock, ArrowRight, GitBranch, Globe } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleOAuth = async (provider: 'google' | 'github') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error(`${provider} login failed:`, err);
    }
  };

  // Redirect back to where they came from, or default to /workspaces
  const from = location.state?.from?.pathname || '/workspaces';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't sign you in. Check your email and password, then try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-[8px] shadow-sm max-w-[400px] w-full p-8 animate-fadeIn">
        <div className="mb-8 text-center">
          <h1 className="text-h2 font-[590] text-foreground">Sign in to DevSync</h1>
        </div>

        {/* §14 Auth: OAuth sits ABOVE the form, divided from it by a
            --border-subtle rule with "or" centred on it. */}
        <div className="space-y-3">
          <Button type="button" onClick={() => handleOAuth('github')} variant="secondary" size="lg" className="w-full">
            <GitBranch className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Continue with GitHub
          </Button>
          <Button type="button" onClick={() => handleOAuth('google')} variant="secondary" size="lg" className="w-full">
            <Globe className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Continue with Google
          </Button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card px-2 text-caption text-subtle-foreground">or</span>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-[8px] bg-danger-muted border border-danger-border p-4 text-ui text-danger-on-muted">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="loginpage-email-address">
              Email Address
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <Input
                id="loginpage-email-address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11"
                placeholder="you@company.com"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="loginpage-password">
                Password
              </Label>
              <Link to="/forgot-password" className="text-caption text-primary hover:text-primary-hover transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <Input
                id="loginpage-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            loading={isLoading}
            variant="primary"
            className="w-full mt-6"
          >
            Sign in
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </form>

        <p className="mt-8 text-center text-ui text-muted-foreground">
          Don't have an account?{' '}
          <Link to="/register" className="font-[510] text-primary hover:text-primary-hover transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
