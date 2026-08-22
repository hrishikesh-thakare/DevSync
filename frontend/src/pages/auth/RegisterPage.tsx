import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { Mail, Lock, User, ArrowRight, GitBranch, Globe } from 'lucide-react';
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
      setError(err instanceof Error ? err.message : "Couldn't create your account. Check the details above and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-[8px] shadow-sm max-w-[400px] w-full p-8 animate-fadeIn">
        <div className="mb-8 text-center">
          <h1 className="text-h2 font-[590] text-foreground">Create your account</h1>
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
            <Label htmlFor="registerpage-full-name">
              Full Name
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <Input
                id="registerpage-full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-11"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="registerpage-email-address">
              Email Address
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <Input
                id="registerpage-email-address"
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
            <Label htmlFor="registerpage-password">
              Password
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <Input
                id="registerpage-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button
            type="submit"
            loading={isLoading}
            variant="primary"
            className="w-full mt-6"
          >
            Create Account
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </form>

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
