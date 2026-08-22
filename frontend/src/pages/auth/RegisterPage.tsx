import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await register({ email, password, fullName });
      navigate('/workspaces', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="auth-shape-1"></div>
      <div className="auth-shape-2"></div>

      <div className="bg-card border border-border rounded-lg shadow-sm max-w-[400px] w-full p-8 animate-fadeIn relative z-[var(--z-sticky)]">
        <div className="mb-10 text-center">
          <h1 className="text-heading font-[590] text-foreground mb-2">Join DevSync</h1>
          <p className="text-muted-foreground text-ui">Create your developer account</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-danger-muted border border-danger-border p-4 text-ui text-danger text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="block text-caption font-[510] text-muted-foreground uppercase tracking-wider mb-2">
              Full Name
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-md text-foreground placeholder:text-subtle-foreground focus:ring-1 focus:ring-ring focus:border-ring transition-colors duration-200 h-auto"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div>
            <Label className="block text-caption font-[510] text-muted-foreground uppercase tracking-wider mb-2">
              Email Address
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-md text-foreground placeholder:text-subtle-foreground focus:ring-1 focus:ring-ring focus:border-ring transition-colors duration-200 h-auto"
                placeholder="you@company.com"
                required
              />
            </div>
          </div>

          <div>
            <Label className="block text-caption font-[510] text-muted-foreground uppercase tracking-wider mb-2">
              Password
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-md text-foreground placeholder:text-subtle-foreground focus:ring-1 focus:ring-ring focus:border-ring transition-colors duration-200 h-auto"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            variant="primary"
            className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md w-full py-3 flex justify-center items-center mt-8 disabled:opacity-70 h-auto"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-foreground" strokeWidth={1.75} />
            ) : (
              <>
                Create Account
                <ArrowRight className="ml-2 h-5 w-5" strokeWidth={1.75} />
              </>
            )}
          </Button>
        </form>

        <div className="mt-8">
          {/* <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-ui">
              <span className="px-2 bg-transparent text-muted-foreground">Or continue with</span>
            </div>
          </div> */}

          <div className="mt-6 space-y-4">
            <Button
              type="button"
              onClick={() => handleOAuth('github')}
              variant="secondary"
              className="bg-card border border-border rounded-lg shadow-sm w-full py-3 hover:bg-hover transition-colors font-[510] text-foreground h-auto"
            >
              Continue with GitHub
            </Button>
            <Button
              type="button"
              onClick={() => handleOAuth('google')}
              variant="secondary"
              className="bg-card border border-border rounded-lg shadow-sm w-full py-3 hover:bg-hover transition-colors font-[510] text-foreground h-auto"
            >
              Continue with Google
            </Button>
          </div>
        </div>

        <p className="mt-8 text-center text-ui text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-[510] text-primary hover:text-primary-hover transition-colors">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
};
