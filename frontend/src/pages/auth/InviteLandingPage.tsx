import { Link, Navigate, useParams } from 'react-router-dom';
import { MailOpenIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { AuthShell } from '@/pages/auth/AuthShell';

/**
 * Entry point for `/invite/:inviteToken`.
 *
 * The backend never actually mints this URL — `sendInviteEmail` links to
 * `/register?inviteToken=…`, and `POST /workspaces/:slug/invites/accept` takes
 * no token at all, flipping the caller's own `invited` membership row to
 * `active`. (docs/navigation-flow.md describes a token-based accept endpoint
 * that does not exist.) The route is kept so that any link of this shape still
 * lands somewhere useful, and it forwards to whichever real flow applies:
 *
 *   - signed out → `/register?inviteToken=…`, where the token is redeemed as
 *     part of creating the account
 *   - signed in  → the workspace picker, which lists pending invites to accept
 *
 * There is no endpoint to read an invite by token, so the workspace behind it
 * cannot be named here without guessing.
 */
export function InviteLandingPage() {
  const { inviteToken = '' } = useParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to={`/register?inviteToken=${encodeURIComponent(inviteToken)}`} replace />;
  }

  return (
    <AuthShell
      title="You have an invitation"
      description="Invitations are accepted from your workspace list."
    >
      <Alert>
        <MailOpenIcon />
        <AlertTitle>Signed in already</AlertTitle>
        <AlertDescription>
          Invitations sent to an existing account appear as pending on your workspace list — accept
          it there. Invite links themselves are only used when creating a new account.
        </AlertDescription>
      </Alert>

      <Button asChild className="w-full">
        <Link to="/workspaces">Go to your workspaces</Link>
      </Button>
    </AuthShell>
  );
}
