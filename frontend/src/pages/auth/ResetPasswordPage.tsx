import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-bg min-h-screen flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg shadow-sm max-w-[400px] w-full p-8 animate-fadeIn relative z-[var(--z-sticky)] text-center">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-foreground mb-6">
            This reset link is invalid. Please request a new password reset link.
          </p>
          <Button asChild variant="primary" className="w-full py-3 text-center h-auto">
            <Link
              to="/forgot-password"
              className="inline-block bg-primary text-primary-foreground hover:bg-primary-hover rounded-md w-full py-3 text-center"
            >
              Request a new link
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="auth-shape-1"></div>
      <div className="auth-shape-2"></div>

      <div className="bg-card border border-border rounded-lg shadow-sm max-w-[400px] w-full p-8 animate-fadeIn relative z-[var(--z-sticky)]">
        <div className="mb-10 text-center">
          <h1 className="text-heading font-[590] text-foreground mb-2">DevSync</h1>
          <p className="text-muted-foreground text-ui">Choose a new password</p>
        </div>

        {done ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-success" strokeWidth={1.5} />
            </div>
            <p className="text-foreground">
              Your password has been reset. All devices were signed out — log in again with your
              new password.
            </p>
            <Button asChild variant="primary" className="w-full py-3 text-center h-auto">
              <Link to="/login" className="inline-block bg-primary text-primary-foreground hover:bg-primary-hover rounded-md w-full py-3 text-center">
                Go to sign in
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 rounded-lg bg-danger-muted border border-danger-border p-4 text-ui text-danger text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="block text-caption font-[510] text-muted-foreground uppercase tracking-wider mb-2">
                  New Password
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
                    placeholder="At least 8 characters"
                    required
                  />
                </div>
                <p className="mt-1.5 text-caption text-muted-foreground">
                  Must include uppercase, lowercase, a number, and a special character.
                </p>
              </div>

              <div>
                <Label className="block text-caption font-[510] text-muted-foreground uppercase tracking-wider mb-2">
                  Confirm Password
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-background border border-border rounded-md text-foreground placeholder:text-subtle-foreground focus:ring-1 focus:ring-ring focus:border-ring transition-colors duration-200 h-auto"
                    placeholder="Re-enter new password"
                    required
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
                  'Reset password'
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};