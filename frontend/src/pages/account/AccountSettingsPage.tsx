import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';
import { initialsOf } from '@/lib/initials';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusCard } from '@/pages/account/StatusCard';
import { PreferencesCard } from '@/pages/account/PreferencesCard';
import { ChangePasswordCard } from '@/pages/account/ChangePasswordCard';
import { SessionsCard } from '@/pages/account/SessionsCard';

/**
 * Account settings, deliberately outside the workspace shell — nothing here is
 * workspace-scoped, and it has to stay reachable from the picker for a user who
 * has not joined a workspace yet.
 *
 * Profile name and email are shown read-only: no endpoint updates them.
 * `PATCH /auth/preferences`, `POST /auth/status`, `POST /auth/change-password`
 * and the `/auth/sessions` family are the full set of writes available.
 */
export function AccountSettingsPage() {
  const user = useAuthStore((s) => s.user);

  const displayName = user?.fullName || user?.email || '';

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link to="/workspaces">
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Back to workspaces
          </Link>
        </Button>

        <PageHeader
          title="Account settings"
          description="Your profile, notification preferences, password and signed-in devices."
        />

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex items-center gap-4">
              <Avatar className="size-12">
                {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback>{initialsOf(displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{displayName}</p>
                <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </CardContent>
          </Card>

          <StatusCard />
          <PreferencesCard />
          <ChangePasswordCard />
          <SessionsCard />
        </div>
      </div>
    </div>
  );
}
