import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth';
import { AuthShell } from '@/pages/auth/AuthShell';
import { AuthErrorAlert } from '@/pages/auth/AuthErrorAlert';
import { OAuthButtons } from '@/pages/auth/OAuthButtons';

/** Mirrors `loginSchema` in backend/src/modules/auth/auth.schemas.ts. */
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (values: LoginValues) => {
    setSubmitError(null);
    try {
      await login(values);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from ?? '/workspaces', { replace: true });
    } catch (err) {
      // Stay on /login and surface the reason inline — the server distinguishes
      // bad credentials (401) from lockout (423) and unverified email (403).
      setSubmitError(err);
    }
  };

  return (
    <AuthShell
      title="Sign in to DevSync"
      description="Use your email and password, or continue with a connected provider."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <OAuthButtons disabled={isSubmitting} />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {/* Only one alert is ever visible: field errors block submit, so an API
          error and a validation error cannot appear at the same time. */}
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

          <Field data-invalid={!!form.formState.errors.password}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                to="/forgot-password"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!form.formState.errors.password}
              {...form.register('password')}
            />
            <FieldError errors={[form.formState.errors.password]} />
          </Field>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
            Sign in
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
