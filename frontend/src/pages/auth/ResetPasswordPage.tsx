import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-bg min-h-screen flex items-center justify-center p-4">
        <div className="glass-card-strong max-w-md w-full p-8 animate-fadeIn glow-purple relative z-10 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <p className="text-text-primary mb-6">
            This reset link is invalid. Please request a new password reset link.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block gradient-btn w-full py-3 text-center"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="auth-shape-1"></div>
      <div className="auth-shape-2"></div>

      <div className="glass-card-strong max-w-md w-full p-8 animate-fadeIn glow-purple relative z-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold gradient-text mb-2">DevSync</h1>
          <p className="text-text-secondary text-sm">Choose a new password</p>
        </div>

        {done ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-400" />
            </div>
            <p className="text-text-primary">
              Your password has been reset. All devices were signed out — log in again with your
              new password.
            </p>
            <Link to="/login" className="inline-block gradient-btn w-full py-3 text-center">
              Go to sign in
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
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-text-secondary" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-bg-primary/50 border border-border-light rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all duration-200"
                    placeholder="At least 8 characters"
                    required
                  />
                </div>
                <p className="mt-1.5 text-xs text-text-secondary">
                  Must include uppercase, lowercase, a number, and a special character.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-text-secondary" />
                  </div>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-bg-primary/50 border border-border-light rounded-xl text-text-primary placeholder-text-secondary focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all duration-200"
                    placeholder="Re-enter new password"
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
                  'Reset password'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};