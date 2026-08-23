import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArchiveIcon, Loader2Icon, LogInIcon, LogOutIcon, SettingsIcon, Trash2Icon, UsersIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { apiFetch } from '@/lib/api';
import { initialsOf } from '@/lib/initials';
import { useAuthStore } from '@/store/auth';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import type { Channel, Presence } from '@/types/api';

interface ChannelMemberRow {
  userId: string;
  joinedAt: string;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
  presence: Presence | null;
}

/**
 * Channel administration, opened from the channel header.
 *
 * The permission split mirrors channels.routes.ts exactly: rename, archive and
 * delete are `requireWorkspaceRole(['owner','admin'])`, while join and leave
 * only need `requireChannelAccess` — any member who can see the channel.
 */
export function ChannelSettingsSheet({ slug, channel }: { slug: string; channel: Channel }) {
  const navigate = useNavigate();
  // Subscribe to the role *value*, not the `isAdmin` helper: the helper is a
  // stable function reference, so a component selecting it never re-renders
  // when the role finally loads and would rule on permissions using the
  // pre-fetch default.
  const myRole = useCurrentWorkspaceStore((s) => s.myRole);
  const updateChannel = useCurrentWorkspaceStore((s) => s.updateChannel);
  const archiveChannel = useCurrentWorkspaceStore((s) => s.archiveChannel);
  const deleteChannel = useCurrentWorkspaceStore((s) => s.deleteChannel);
  const joinChannel = useCurrentWorkspaceStore((s) => s.joinChannel);
  const leaveChannel = useCurrentWorkspaceStore((s) => s.leaveChannel);
  const me = useAuthStore((s) => s.user);

  const canAdmin = myRole === 'owner' || myRole === 'admin';

  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<ChannelMemberRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? '');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const data = await apiFetch(`/workspaces/${slug}/channels/${channel.channelId}`);
        setMembers(data.members ?? []);
      } catch {
        // The roster is supporting detail — the rest of the panel still works.
        setMembers([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [open, slug, channel.channelId]);

  const isMember = members.some((m) => m.userId === me?.userId);

  const save = async () => {
    const patch: { name?: string; description?: string } = {};
    if (name.trim() && name.trim() !== channel.name) patch.name = name.trim();
    if (description !== (channel.description ?? '')) patch.description = description;
    if (Object.keys(patch).length === 0) return;

    setSaving(true);
    try {
      await updateChannel(slug, channel.channelId, patch);
      toast.success('Channel updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the channel.');
    } finally {
      setSaving(false);
    }
  };

  const run = async (label: string, fn: () => Promise<void>, after?: () => void) => {
    setBusy(label);
    try {
      await fn();
      after?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not ${label} this channel.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="ml-auto" aria-label="Channel settings">
          <SettingsIcon className="size-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <ScrollArea className="flex-1">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle>#{channel.name}</SheetTitle>
          <SheetDescription>
            {channel.type === 'public' ? 'Public channel' : 'Private channel'}
            {channel.projectId ? ' · scoped to a project' : ' · workspace-wide'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          {canAdmin ? (
            <section>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="channelName">Name</FieldLabel>
                  <Input
                    id="channelName"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="channelDescription">Description</FieldLabel>
                  <Textarea
                    id="channelDescription"
                    rows={3}
                    value={description}
                    placeholder="What is this channel for?"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <div>
                  <Button onClick={() => void save()} disabled={saving || !name.trim()}>
                    {saving ? (
                      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Save changes
                  </Button>
                </div>
              </FieldGroup>
            </section>
          ) : null}

          {canAdmin ? <Separator /> : null}

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <UsersIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              Members ({members.length})
            </h3>

            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {channel.type === 'public'
                  ? 'Nobody has joined explicitly — every workspace member can read and post here.'
                  : 'No members yet.'}
              </p>
            ) : (
              <ul className="space-y-1">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                    <Avatar className="size-6 shrink-0">
                      {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-[10px]">
                        {initialsOf(m.displayName || m.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {m.displayName || m.fullName}
                    </span>
                    {m.userId === me?.userId ? <Badge variant="secondary">You</Badge> : null}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              {isMember ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === 'leave'}
                  onClick={() =>
                    void run('leave', () => leaveChannel(slug, channel.channelId), () => {
                      toast.success(`Left #${channel.name}`);
                      setOpen(false);
                      navigate(`/w/${slug}/channels`);
                    })
                  }
                >
                  {busy === 'leave' ? (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <LogOutIcon className="size-4" aria-hidden="true" />
                  )}
                  Leave channel
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === 'join'}
                  onClick={() =>
                    void run('join', () => joinChannel(slug, channel.channelId), () => {
                      toast.success(`Joined #${channel.name}`);
                      // Reflect the new membership without reopening the panel.
                      if (me) {
                        setMembers((prev) => [
                          ...prev,
                          {
                            userId: me.userId,
                            joinedAt: new Date().toISOString(),
                            fullName: me.fullName,
                            displayName: null,
                            avatarUrl: me.avatarUrl ?? null,
                            presence: 'online',
                          },
                        ]);
                      }
                    })
                  }
                >
                  {busy === 'join' ? (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <LogInIcon className="size-4" aria-hidden="true" />
                  )}
                  Join channel
                </Button>
              )}
            </div>
          </section>

          {canAdmin ? (
            <>
              <Separator />
              <section>
                <h3 className="mb-1 text-sm font-medium text-foreground">Danger zone</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  Archiving hides the channel but keeps its history. Deleting removes it and every
                  message in it.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === 'archive'}
                    onClick={() =>
                      void run('archive', () => archiveChannel(slug, channel.channelId), () => {
                        toast.success(`#${channel.name} archived`);
                        navigate(`/w/${slug}/channels`);
                      })
                    }
                  >
                    {busy === 'archive' ? (
                      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ArchiveIcon className="size-4" aria-hidden="true" />
                    )}
                    Archive
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={busy === 'delete'}>
                        <Trash2Icon className="size-4" aria-hidden="true" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete #{channel.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Every message in this channel is removed permanently. This cannot be
                          undone — archive it instead if you only want it out of the way.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.preventDefault();
                            void run('delete', () => deleteChannel(slug, channel.channelId), () => {
                              toast.success(`#${channel.name} deleted`);
                              navigate(`/w/${slug}/channels`);
                            });
                          }}
                        >
                          Delete channel
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </section>
            </>
          ) : null}

          {!canAdmin ? (
            <p className="text-xs text-muted-foreground">
              Renaming, archiving and deleting a channel are reserved for workspace owners and
              admins.
            </p>
          ) : null}
        </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
