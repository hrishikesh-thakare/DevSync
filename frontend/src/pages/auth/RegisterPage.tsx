import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth';
import { AuthShell } from '@/pages/auth/AuthShell';
import { AuthErrorAlert } from '@/pages/auth/AuthErrorAlert';
import { OAuthButtons } from '@/pages/auth/OAuthButtons';

/**
 * Mirrors `registerSchema` in backend/src/modules/auth/auth.schemas.ts — same
 * password regex, so the client never accepts something the server will reject.
 * That schema is `.strict()`, so send exactly these three keys and nothing more.
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z
    .string()
    .regex(
      PASSWORD_REGEX,
      'Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character (@$!%*?&).',
    ),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const registerUser = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const { isSubmitting, errors } = form.formState;

  const onSubmit = async (values: RegisterValues) => {
    setSubmitError(null);
    try {
      await registerUser(values);
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
              <FieldDescription>
                At least 8 characters, with upper and lower case, a number, and one of @$!%*?&amp;
              </FieldDescription>
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
