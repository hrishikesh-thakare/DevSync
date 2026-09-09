import { OctagonXIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ApiError } from '@/lib/api';

/**
 * Renders the auth failure states the backend deliberately distinguishes.
 * The server's own message is always shown verbatim — it carries detail the
 * client cannot reconstruct, such as the exact minutes left on a lockout.
 *
 * `Alert` renders `role="alert"`, which is what the Playwright auth specs
 * assert on. Only ever render one of these at a time: two visible alerts make
 * `getByRole('alert')` ambiguous and the test fails on strict mode, not on the
 * behaviour it meant to check.
 */
function hintFor(status: number): React.ReactNode {
  switch (status) {
    case 400:
      // "This account uses Google/GitHub login. Please sign in using OAuth."
      return 'Use one of the provider buttons above instead.';
    case 403:
      return 'Check your inbox for the verification link, then try again.';
    case 423:
      return 'Too many failed attempts. The lock clears on its own — or reset your password to unlock sooner.';
    case 429:
      return 'Too many attempts from this network. Wait a few minutes before retrying.';
    default:
      return null;
  }
}

export function AuthErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;

  const status = error instanceof ApiError ? error.status : 0;
  const message =
    error instanceof Error
      ? error.message
      : 'Could not reach the server. Check your connection and try again.';
  const hint = hintFor(status);

  return (
    <Alert variant="destructive">
      <OctagonXIcon />
      <AlertTitle>{message}</AlertTitle>
      {hint ? (
        <AlertDescription>{hint}</AlertDescription>
      ) : null}
    </Alert>
  );
}
