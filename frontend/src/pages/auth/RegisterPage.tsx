import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2Icon, MailOpenIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { PASSWORD_ERROR, PASSWORD_REGEX, PASSWORD_RULE } from '@/lib/password';
import { useAuthStore } from '@/store/auth';
import { AuthShell } from '@/pages/auth/AuthShell';
import { AuthErrorAlert } from '@/pages/auth/AuthErrorAlert';
import { OAuthButtons } from '@/pages/auth/OAuthButtons';

/**
 * Mirrors `registerSchema` in backend/src/modules/auth/auth.schemas.ts — same
 * password regex, so the client never accepts something the server will reject.
 * That schema is `.strict()`, so send exactly these keys and nothing more;
 * `inviteToken` is added only when the URL actually carries one.
 */
const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().regex(PASSWORD_REGEX, PASSWORD_ERROR),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const registerUser = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [submitError, setSubmitError] = useState<unknown>(null);

  // Invite emails link here, not to `/invite/:token` — `sendInviteEmail` builds
  // `${FRONTEND_URL}/register?inviteToken=…`. The server redeems the token as
  // part of creating the account, and rejects it if the email typed below is
  // not the address that was invited.
  const inviteToken = params.get('inviteToken');

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const { isSubmitting, errors } = form.formState;

  const onSubmit = async (values: RegisterValues) => {
    setSubmitError(null);
    try {
      await registerUser(inviteToken ? { ...values, inviteToken } : values);
      navigate('/workspaces', { replace: true });
    } catch (err) {
      setSubmitError(err);
    }
  };

  return (
    <AuthShell
      title="Create your DevSync account"
      description="One account for your workspaces, projects, and channels."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      {inviteToken ? (
        <Alert>
          <MailOpenIcon />
          <AlertTitle>You&apos;re joining by invitation</AlertTitle>
          <AlertDescription>
            Sign up with the email address the invite was sent to — the workspace is added to your
            account automatically.
          </AlertDescription>
        </Alert>
      ) : null}

      <OAuthButtons disabled={isSubmitting} />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {submitError ? <AuthErrorAlert error={submitError} /> : null}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.fullName}>
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Ada Lovelace"
              aria-invalid={!!errors.fullName}
              {...form.register('fullName')}
            />
            <FieldError errors={[errors.fullName]} />
          </Field>

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register('password')}
            />
            {errors.password ? (
              <FieldError errors={[errors.password]} />
            ) : (
              <FieldDescription>{PASSWORD_RULE}</FieldDescription>
            )}
          </Field>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
            Create account
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
