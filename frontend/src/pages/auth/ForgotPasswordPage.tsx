import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request a password reset.');
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
          <p className="text-text-secondary text-sm">Reset your password</p>
        </div>

        {sent ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-400" />
            </div>
            <p className="text-text-primary">
              If an account exists for <strong className="text-primary-400">{email}</strong>, a
              password reset link has been sent. Check your inbox — the link expires in 30 minutes.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
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

              <button
                type="submit"
                disabled={isLoading}
                className="gradient-btn w-full py-3 flex justify-center items-center mt-8 disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-bg-primary" />
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-text-secondary">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 font-medium text-primary-400 hover:text-primary-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};