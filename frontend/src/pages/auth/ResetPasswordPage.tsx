import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2Icon, Loader2Icon, OctagonXIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { apiFetch } from '@/lib/api';
import { PASSWORD_ERROR, PASSWORD_REGEX, PASSWORD_RULE } from '@/lib/password';
import { useAuthStore } from '@/store/auth';
import { AuthShell } from '@/pages/auth/AuthShell';
import { AuthErrorAlert } from '@/pages/auth/AuthErrorAlert';

/**
 * Mirrors `resetPasswordSchema`. The confirmation field is client-only — the
 * server takes `{ token, newPassword }` and nothing else, and that schema is
 * `.strict()`, so the extra key is stripped before the request goes out.
 */
const resetSchema = z
  .object({
    newPassword: z.string().regex(PASSWORD_REGEX, PASSWORD_ERROR),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [submitError, setSubmitError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const { isSubmitting, errors } = form.formState;

  const onSubmit = async (values: ResetValues) => {
    setSubmitError(null);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: values.newPassword }),
      });
      // A successful reset revokes every refresh token for the account, this
      // browser's included. Clearing local auth state keeps the client honest
      // about that rather than leaving a stale token that fails on next use.
      await logout();
      setDone(true);
    } catch (err) {
      setSubmitError(err);
    }
  };

  if (!token) {
    return (
      <AuthShell
        title="Reset link is incomplete"
        description="This page needs the token from your reset email."
        footer={
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Back to sign in
          </Link>
        }
      >
        <Alert variant="destructive">
          <OctagonXIcon />
          <AlertTitle>No reset token in the address</AlertTitle>
          <AlertDescription>
            Open the link from your email directly, or request a new one.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated" description="You can sign in with your new password now.">
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Password reset successfully</AlertTitle>
          <AlertDescription>
            Every device that was signed in has been signed out, including this one.
          </AlertDescription>
        </Alert>
        <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
          Go to sign in
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Pick something you haven't used here before."
      footer={
        <Link to="/login" className="text-foreground underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {submitError ? <AuthErrorAlert error={submitError} /> : null}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.newPassword}>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...form.register('newPassword')}
            />
            {errors.newPassword ? (
              <FieldError errors={[errors.newPassword]} />
            ) : (
              <FieldDescription>{PASSWORD_RULE}</FieldDescription>
            )}
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...form.register('confirmPassword')}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
            Reset password
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
