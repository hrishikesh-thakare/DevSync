import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';
import { initialsOf } from '@/lib/initials';
import { apiFetch } from '@/lib/api';
import { fileToBase64, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/files';
import { useFileUpload } from '@/hooks/use-file-upload';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusCard } from '@/pages/account/StatusCard';
import { PreferencesCard } from '@/pages/account/PreferencesCard';
import { ChangePasswordCard } from '@/pages/account/ChangePasswordCard';
import { SessionsCard } from '@/pages/account/SessionsCard';
import { DeleteAccountCard } from '@/pages/account/DeleteAccountCard';

/**
 * Account settings, deliberately outside the workspace shell — nothing here is
 * workspace-scoped, and it has to stay reachable from the picker for a user who
 * has not joined a workspace yet.
 *
 * Profile name and email are shown read-only: no endpoint updates them. The
 * avatar is the one exception — `PATCH /auth/profile`, `PATCH /auth/preferences`,
 * `POST /auth/status`, `POST /auth/change-password` and the `/auth/sessions`
 * family are the full set of writes available.
 */
export function AccountSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateAvatar = useAuthStore((s) => s.updateAvatar);

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
              <AvatarUpload
                avatarUrl={user?.avatarUrl ?? null}
                displayName={displayName}
                onChange={updateAvatar}
              />
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
          <DeleteAccountCard />
        </div>
      </div>
    </div>
  );
}

/**
 * `useFileUpload` (installed from the reui registry) only manages local
 * selection/preview state — it does no uploading itself. The actual upload
 * goes through `POST /auth/avatar`, not straight to Supabase from the
 * browser: `workspace-files` is a private bucket, so only the backend's
 * service-role key can write to it or mint a URL for what it stores (same
 * reasoning as `MessageComposer`'s attachments, which hit the equivalent
 * workspace-scoped endpoint — an avatar has no workspace, hence its own
 * dedicated route). The returned URL is then handed to `PATCH /auth/profile`
 * via `onChange`, unchanged from before.
 */
function AvatarUpload({
  avatarUrl,
  displayName,
  onChange,
}: {
  avatarUrl: string | null;
  displayName: string;
  onChange: (avatarUrl: string | null) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);

  const [, { openFileDialog, getInputProps }] = useFileUpload({
    accept: 'image/*',
    onFilesAdded: (added) => {
      const picked = added[0]?.file;
      if (!(picked instanceof File)) return;
      void (async () => {
        setUploading(true);
        try {
          if (picked.size > MAX_UPLOAD_BYTES) {
            throw new Error(`Image is larger than the ${formatBytes(MAX_UPLOAD_BYTES)} limit.`);
          }
          const { avatarUrl: uploadedUrl } = await apiFetch('/auth/avatar', {
            method: 'POST',
            body: JSON.stringify({
              filename: picked.name,
              mimetype: picked.type || 'application/octet-stream',
              sizeBytes: picked.size,
              fileBase64: await fileToBase64(picked),
            }),
          });
          await onChange(uploadedUrl);
          toast.success('Avatar updated');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not update your avatar.');
        } finally {
          setUploading(false);
        }
      })();
    },
  });

  return (
    <div className="relative shrink-0">
      <Avatar className="size-12">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback>{initialsOf(displayName)}</AvatarFallback>
      </Avatar>
      <button
        type="button"
        onClick={openFileDialog}
        disabled={uploading}
        aria-label="Change avatar"
        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none disabled:opacity-100"
      >
        {uploading ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <span className="text-[10px] font-medium">Edit</span>
        )}
      </button>
      <input {...getInputProps()} className="sr-only" aria-label="Upload avatar image" tabIndex={-1} />
    </div>
  );
}
