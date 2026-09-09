import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2Icon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { apiFetch } from '@/lib/api';
import { PASSWORD_ERROR, PASSWORD_REGEX, PASSWORD_RULE } from '@/lib/password';

/**
 * Mirrors `changePasswordSchema`. `confirmPassword` is client-only — that
 * schema is `.strict()`, so only the two keys it names are sent.
 */
const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().regex(PASSWORD_REGEX, PASSWORD_ERROR),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type Values = z.infer<typeof schema>;

export function ChangePasswordCard() {
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const { isSubmitting, errors } = form.formState;

  const onSubmit = async (values: Values) => {
    setError(null);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      form.reset();
      // The server revokes every other refresh token as part of this change,
      // keeping only the session that made the request.
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Changing your password signs out every other device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        ) : null}

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.currentPassword}>
              <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.currentPassword}
                {...form.register('currentPassword')}
              />
              <FieldError errors={[errors.currentPassword]} />
            </Field>

            <Field data-invalid={!!errors.newPassword}>
              <FieldLabel htmlFor="accountNewPassword">New password</FieldLabel>
              <Input
                id="accountNewPassword"
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
              <FieldLabel htmlFor="accountConfirmPassword">Confirm new password</FieldLabel>
              <Input
                id="accountConfirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                {...form.register('confirmPassword')}
              />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>

            <div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Change password
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
