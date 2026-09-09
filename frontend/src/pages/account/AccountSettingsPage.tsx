import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';

import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth';
import { socketClient } from '@/lib/socket';
import { PRESENCE_STYLE } from '@/lib/presence';
import { initialsOf } from '@/lib/initials';
import { cn } from '@/lib/utils';
import type { Presence } from '@/types/api';
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

  // There is no read endpoint for presence — `GET /auth/me` doesn't carry it
  // (see `StatusCard`'s own comment on the same trick: an empty-bodied `POST
  // /auth/status` updates nothing but `lastActiveAt` and hands back what's
  // already stored). `StatusCard` does this same fetch for its own form; this
  // is a second, independent read so the profile card can show it too without
  // threading state through a prop neither component otherwise needs.
  const [presence, setPresence] = useState<Presence | null>(null);
  useEffect(() => {
    void apiFetch('/auth/status', { method: 'POST', body: JSON.stringify({}) })
      .then((data) => setPresence((data.user?.presence as Presence) ?? null))
      .catch(() => {});
  }, []);

  // This page has no workspace in scope to join a `workspace:` room with —
  // it's reachable before a user has joined any workspace at all — so a
  // second tab or device open here would otherwise never learn about a
  // presence change made on this same page elsewhere. `broadcastPresence`
  // addresses the author's own `user:{userId}` room precisely so this can
  // listen without one. Mirrors `WorkspaceLayout`'s identical connect/cleanup
  // shape, just scoped to one event instead of the whole realtime feed.
  useEffect(() => {
    if (!user?.userId) return;
    const socket = socketClient.connect();

    const onPresence = (payload: { userId: string; presence: Presence }) => {
      if (payload.userId === user.userId) setPresence(payload.presence);
    };
    socket.on('user_presence_updated', onPresence);

    return () => {
      socket.off('user_presence_updated', onPresence);
      socketClient.disconnect();
    };
  }, [user?.userId]);

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link to="/workspaces">
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Back to workspaces
          </Link>
        </Button>

        <PageHeader
          title="Account settings"
          description="Manage your profile, preferences, and security settings."
        />

        <Tabs defaultValue="profile" orientation="vertical" className="mt-8 flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 shrink-0">
            <TabsList variant="line" className="w-full sm:w-auto overflow-x-auto sm:overflow-visible">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="account" className="data-[state=active]:text-destructive dark:data-[state=active]:text-destructive hover:text-destructive">
                Account
              </TabsTrigger>
            </TabsList>
          </aside>

          <main className="flex-1 min-w-0">
            <TabsContent value="profile" className="m-0 grid gap-6 md:grid-cols-2 md:items-start">
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>How your teammates see you across every workspace.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                  <AvatarUpload
                    avatarUrl={user?.avatarUrl ?? null}
                    displayName={displayName}
                    presence={presence}
                    onChange={updateAvatar}
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium text-foreground">{displayName}</p>
                    <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
                    {presence ? (
                      <Badge className={cn('font-medium', PRESENCE_STYLE[presence].chip)}>
                        {PRESENCE_STYLE[presence].label}
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
              <StatusCard onSaved={setPresence} />
            </TabsContent>

            <TabsContent value="preferences" className="m-0 flex flex-col gap-6">
              <PreferencesCard />
            </TabsContent>

            <TabsContent value="security" className="m-0 flex flex-col gap-6">
              <ChangePasswordCard />
              <SessionsCard />
            </TabsContent>

            <TabsContent value="account" className="m-0 flex flex-col gap-6">
              <DeleteAccountCard />
            </TabsContent>
          </main>
        </Tabs>
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
  presence,
  onChange,
}: {
  avatarUrl: string | null;
  displayName: string;
  presence?: Presence | null;
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
        {presence ? <AvatarBadge className={cn('border-0', PRESENCE_STYLE[presence].dot)} aria-hidden="true" /> : null}
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
