import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MailPlusIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';

import { MemberAvatar } from '@/components/MemberAvatar';
import { ErrorState, TableSkeleton } from '@/components/layout/PageState';
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { LeaveWorkspaceButton } from '@/pages/workspaces/LeaveWorkspaceButton';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { useAuthStore } from '@/store/auth';
import { apiFetch } from '@/lib/api';
import type { WorkspaceMember, WorkspaceRole } from '@/types/api';

const ROLES: { value: WorkspaceRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

const STATES: { value: string; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'deactivated', label: 'Deactivated' },
];

const ANY = '__any__';

function RoleBadge({ role }: { role: WorkspaceRole }) {
  switch (role) {
    case 'owner':
      return (
        <Badge className="bg-rose-600 text-white hover:bg-rose-600/90 dark:bg-rose-500 dark:text-white font-semibold shadow-xs">
          Owner
        </Badge>
      );
    case 'admin':
      return (
        <Badge className="bg-blue-600 text-white hover:bg-blue-600/90 dark:bg-blue-500 dark:text-white font-medium shadow-xs">
          Admin
        </Badge>
      );
    case 'member':
    default:
      return (
        <Badge className="bg-indigo-600 text-white hover:bg-indigo-600/90 dark:bg-indigo-500 dark:text-white font-medium shadow-xs">
          Member
        </Badge>
      );
  }
}

function StatusBadge({ state }: { state: string }) {
  switch (state) {
    case 'active':
      return (
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-500 dark:text-white font-semibold shadow-xs">
          Active
        </Badge>
      );
    case 'invited':
      return (
        <Badge className="bg-amber-500 text-white hover:bg-amber-500/90 dark:bg-amber-500 dark:text-white font-medium shadow-xs">
          Invited
        </Badge>
      );
    case 'deactivated':
    default:
      return (
        <Badge className="bg-red-600 text-white hover:bg-red-600/90 dark:bg-red-500 dark:text-white font-medium shadow-xs">
          Deactivated
        </Badge>
      );
  }
}

export function WorkspaceMembersPage() {
  const { slug = '' } = useParams();
  const {
    members,
    myRole,
    isAdmin,
    isOwner,
    fetchWorkspaceData,
    isLoading,
    error,
  } = useCurrentWorkspaceStore();
  const myUserId = useAuthStore((s) => s.user?.userId);

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState(ANY);
  const [stateFilter, setStateFilter] = useState(ANY);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);

  const hasFilters = filter.trim() !== '' || roleFilter !== ANY || stateFilter !== ANY;

  // A long-lived workspace can carry hundreds of members and the API returns
  // them all in one payload, so the narrowing happens here.
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return members.filter(
      (m) =>
        (!q || [m.fullName, m.displayName, m.email].some((v) => v?.toLowerCase().includes(q))) &&
        (roleFilter === ANY || m.role === roleFilter) &&
        (stateFilter === ANY || m.state === stateFilter),
    );
  }, [members, filter, roleFilter, stateFilter]);

  const canInvite = isAdmin();
  const canChangeRoles = isOwner();
  const showActionColumn = canInvite || canChangeRoles;

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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or email"
          aria-label="Filter members"
          className="max-w-xs"
        />

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All statuses</SelectItem>
            {STATES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilter('');
              setRoleFilter(ANY);
              setStateFilter(ANY);
            }}
          >
            Clear filters
          </Button>
        ) : null}

        <p className="ml-auto text-xs text-muted-foreground">
          {visible.length === members.length
            ? `${members.length} members`
            : `${visible.length} of ${members.length} members`}
        </p>
      </div>

      {error ? <ErrorState message={error} className="mb-4" /> : null}

      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          {/* The roster comes from the shared workspace fetch, so a cold load
              previously rendered an empty table that looked like "no members". */}
          {isLoading && members.length === 0 ? <TableSkeleton /> : null}
          <Table hidden={isLoading && members.length === 0}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead className="w-40">Role</TableHead>
                <TableHead className="w-36">Status</TableHead>
                {showActionColumn ? <TableHead className="w-16 text-right"><span className="sr-only">Actions</span></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showActionColumn ? 4 : 3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No member matches that search.
                  </TableCell>
                </TableRow>
              ) : null}
              {visible.map((member) => {
                const name = member.displayName || member.fullName;
                const isMe = member.userId === myUserId;
                const isTheOwner = member.role === 'owner';
                const hasActions = (canChangeRoles && !isMe) || (canInvite && !isMe && !isTheOwner);

                return (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3.5">
                        <MemberAvatar member={member} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {name}
                            {isMe ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>

                    <TableCell>
                      <StatusBadge state={member.state} />
                    </TableCell>

                    {showActionColumn ? (
                      <TableCell className="text-right">
                        {hasActions ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground"
                                disabled={busy === member.userId}
                              >
                                <MoreHorizontalIcon className="size-4" />
                                <span className="sr-only">Actions for {name}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {canChangeRoles && !isMe ? (
                                <>
                                  <DropdownMenuLabel>Role</DropdownMenuLabel>
                                  <DropdownMenuRadioGroup
                                    value={member.role}
                                    onValueChange={(val) => void changeRole(member.userId, val as WorkspaceRole)}
                                  >
                                    {ROLES.map((r) => (
                                      <DropdownMenuRadioItem key={r.value} value={r.value} className="cursor-pointer">
                                        {r.label}
                                      </DropdownMenuRadioItem>
                                    ))}
                                  </DropdownMenuRadioGroup>
                                </>
                              ) : null}

                              {canInvite && !isMe && !isTheOwner ? (
                                <>
                                  {canChangeRoles ? <DropdownMenuSeparator /> : null}
                                  <DropdownMenuItem
                                    variant="destructive"
                                    className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                                    onClick={() => setMemberToRemove(member)}
                                  >
                                    <Trash2Icon className="mr-2 size-4 text-destructive" />
                                    Remove member
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation dialog for member removal */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {memberToRemove?.displayName || memberToRemove?.fullName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to every project and channel in this workspace.
              Their tasks and messages stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs"
              onClick={() => {
                if (memberToRemove) {
                  const name = memberToRemove.displayName || memberToRemove.fullName || 'Member';
                  void remove(memberToRemove.userId, name);
                  setMemberToRemove(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 text-xs text-muted-foreground">Your role: {myRole}</p>
    </PageShell>
  );
}
