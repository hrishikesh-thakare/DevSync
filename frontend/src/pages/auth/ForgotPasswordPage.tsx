import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

      <div className="bg-card border border-border rounded-lg shadow-sm max-w-md w-full p-8 animate-fadeIn relative z-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">DevSync</h1>
          <p className="text-muted-foreground text-sm">Reset your password</p>
        </div>

        {sent ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-success" />
            </div>
            <p className="text-foreground">
              If an account exists for <strong className="text-primary">{email}</strong>, a
              password reset link has been sent. Check your inbox — the link expires in 30 minutes.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 rounded-lg bg-danger-muted border border-danger-border p-4 text-sm text-danger text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-muted-foreground" />
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

              <Button
                type="submit"
                disabled={isLoading}
                variant="default"
                className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md w-full py-3 flex justify-center items-center mt-8 disabled:opacity-70 h-auto"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                ) : (
                  'Send reset link'
                )}
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:text-primary-hover transition-colors"
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