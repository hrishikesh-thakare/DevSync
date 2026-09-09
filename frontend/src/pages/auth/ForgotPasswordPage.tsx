import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2Icon, Loader2Icon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { apiFetch } from '@/lib/api';
import { AuthShell } from '@/pages/auth/AuthShell';
import { AuthErrorAlert } from '@/pages/auth/AuthErrorAlert';

/** Mirrors `forgotPasswordSchema` — one key, and the schema is `.strict()`. */
const forgotSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: ForgotValues) => {
    setSubmitError(null);
    try {
      const data = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: values.email }),
      });
      // The endpoint answers 200 whether or not the address has an account —
      // that is deliberate, so it cannot be used to enumerate users. The
      // confirmation below has to be equally non-committal for the same reason.
      setSentTo(values.email);
      // Outside production the server hands back the reset link instead of
      // relying on SMTP, which is the only way this flow is usable locally.
      setDevLink(typeof data.resetUrl === 'string' ? data.resetUrl : null);
    } catch (err) {
      setSubmitError(err);
    }
  };

  if (sentTo) {
    return (
      <AuthShell
        title="Check your inbox"
        description="If an account exists for that address, a reset link is on its way."
        footer={
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Back to sign in
          </Link>
        }
      >
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Reset link sent to {sentTo}</AlertTitle>
          <AlertDescription>
            The link is valid for a limited time and can only be used once.
          </AlertDescription>
        </Alert>

        {devLink ? (
          <div className="rounded-xl border border-dashed p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Development only — no mail server is configured, so the link is returned inline.
            </p>
            <a
              href={devLink}
              className="mt-1 block break-all text-xs text-foreground underline underline-offset-4"
            >
              {devLink}
            </a>
          </div>
        ) : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email on your account and we'll send you a reset link."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Back to sign in
          </Link>
        </>
      }
    >
      {submitError ? <AuthErrorAlert error={submitError} /> : null}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!form.formState.errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!form.formState.errors.email}
              {...form.register('email')}
            />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
            Send reset link
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
