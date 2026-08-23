import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MailPlusIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { LeaveWorkspaceButton } from '@/pages/workspaces/LeaveWorkspaceButton';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { useAuthStore } from '@/store/auth';
import { apiFetch } from '@/lib/api';
import { initialsOf } from '@/lib/initials';
import type { WorkspaceRole } from '@/types/api';

const ROLES: { value: WorkspaceRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

const STATE_VARIANT = {
  active: 'secondary',
  invited: 'outline',
  deactivated: 'outline',
} as const;

export function WorkspaceMembersPage() {
  const { slug = '' } = useParams();
  const { members, myRole, isAdmin, isOwner, fetchWorkspaceData } = useCurrentWorkspaceStore();
  const myUserId = useAuthStore((s) => s.user?.userId);

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  // A long-lived workspace can carry hundreds of members and the API returns
  // them all in one payload, so the narrowing happens here.
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.fullName, m.displayName, m.email].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [members, filter]);

  const canInvite = isAdmin();
  const canChangeRoles = isOwner();

  const invite = async () => {
    if (!email.trim()) return;
    setBusy('invite');
    try {
      const data = await apiFetch(`/workspaces/${slug}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role: inviteRole }),
      });
      setEmail('');
      toast.success(data?.message ?? 'Invitation sent');
      await fetchWorkspaceData(slug);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the invitation.');
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (userId: string, role: WorkspaceRole) => {
    setBusy(userId);
    try {
      await apiFetch(`/workspaces/${slug}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      // Promoting someone to owner transfers ownership and demotes the caller,
      // so the whole workspace payload has to be refetched, not patched locally.
      await fetchWorkspaceData(slug);
      toast.success('Role updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the role.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (userId: string, name: string) => {
    setBusy(userId);
    try {
      await apiFetch(`/workspaces/${slug}/members/${userId}`, { method: 'DELETE' });
      await fetchWorkspaceData(slug);
      toast.success(`${name} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove the member.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Members"
        description={
          canChangeRoles
            ? 'Owners can change any role. Promoting someone to owner transfers ownership and makes you an admin.'
            : canInvite
              ? 'You can invite people and remove members. Only the owner can change roles.'
              : `${members.length} people have access to this workspace.`
        }
        actions={<LeaveWorkspaceButton slug={slug} canLeave={myRole !== 'owner'} />}
      />

      {canInvite ? (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label htmlFor="invite-email" className="mb-1.5 block text-sm text-foreground">
                Invite by email
              </label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
              />
            </div>
            <div className="w-40">
              <label htmlFor="invite-role" className="mb-1.5 block text-sm text-foreground">
                Role
              </label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r.value !== 'owner').map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => void invite()} disabled={!email.trim() || busy === 'invite'}>
              <MailPlusIcon className="size-4" aria-hidden="true" />
              Send invite
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <Input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or email"
          aria-label="Filter members"
          className="max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          {visible.length === members.length
            ? `${members.length} members`
            : `${visible.length} of ${members.length} members`}
        </p>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {canInvite ? <TableHead className="w-24" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canInvite ? 4 : 3}
                    className="text-center text-muted-foreground"
                  >
                    No member matches that search.
                  </TableCell>
                </TableRow>
              ) : null}
              {visible.map((member) => {
                const name = member.displayName || member.fullName;
                const isMe = member.userId === myUserId;
                const isTheOwner = member.role === 'owner';
                return (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-xs">{initialsOf(name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-foreground">
                            {name}
                            {isMe ? <span className="text-muted-foreground"> (you)</span> : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      {/* The server rejects changing your own role, so that row
                          stays a plain badge even for the owner. */}
                      {canChangeRoles && !isMe ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => void changeRole(member.userId, v as WorkspaceRole)}
                          disabled={busy === member.userId}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={member.role === 'owner' ? 'default' : 'outline'}>
                          {member.role}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant={STATE_VARIANT[member.state] ?? 'outline'}>{member.state}</Badge>
                    </TableCell>

                    {canInvite ? (
                      <TableCell className="text-right">
                        {isMe || isTheOwner ? null : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={busy === member.userId}>
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  They lose access to every project and channel in this workspace.
                                  Their tasks and messages stay.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void remove(member.userId, name)}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">Your role: {myRole}</p>
    </PageShell>
  );
}
