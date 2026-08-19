import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.js';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';

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
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="auth-shape-1"></div>
      <div className="auth-shape-2"></div>

      <div className="glass-card-strong max-w-md w-full p-8 animate-fadeIn glow-purple relative z-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold gradient-text mb-2">DevSync</h1>
          <p className="text-text-secondary text-sm">Sign in to your workspace</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-text-secondary" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-bg-primary/50 border border-border-light rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all duration-200"
                placeholder="you@company.com"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-text-secondary" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-bg-primary/50 border border-border-light rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all duration-200"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="gradient-btn w-full py-3 flex justify-center items-center mt-8 disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-bg-primary" />
            ) : (
              <>
                Sign in
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8">
          {/* <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-light"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-text-secondary">Or continue with</span>
            </div>
          </div> */}

          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              className="glass-card w-full py-3 hover:bg-bg-hover transition-colors font-medium text-text-primary"
            >
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              className="glass-card w-full py-3 hover:bg-bg-hover transition-colors font-medium text-text-primary"
            >
              Continue with Google
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-text-secondary">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-primary-400 hover:text-primary-300 transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
