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
      setError(err instanceof Error ? err.message : "Couldn't send the reset email. Check the address and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
            <div className="bg-card rounded-[8px] shadow-sm max-w-[400px] w-full p-8 animate-fadeIn">
        <div className="mb-10 text-center">
          <h1 className="text-h1 font-[590] text-foreground mb-2">DevSync</h1>
          <p className="text-muted-foreground text-ui">Reset your password</p>
        </div>

        {sent ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-success" strokeWidth={1.5} />
            </div>
            <p className="text-foreground">
              If an account exists for <strong className="text-primary">{email}</strong>, a
              password reset link has been sent. Check your inbox — the link expires in 30 minutes.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-ui font-[510] text-primary hover:text-primary-hover transition-colors"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="mb-6 rounded-[8px] bg-danger-muted border border-danger-border p-4 text-ui text-danger-on-muted">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="forgotpasswordpage-email-address">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  <Input
                    id="forgotpasswordpage-email-address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11"
                    placeholder="you@company.com"
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
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-foreground" strokeWidth={1.75} />
                ) : (
                  'Send reset link'
                )}
              </Button>
            </form>

            <p className="mt-8 text-center text-ui text-muted-foreground">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 font-[510] text-primary hover:text-primary-hover transition-colors"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};