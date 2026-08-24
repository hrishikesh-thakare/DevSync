import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MoreHorizontalIcon, Trash2Icon, UserPlusIcon } from 'lucide-react';

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
import { useProjectStore, useMyProjectRole } from '@/store/projectStore';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { initialsOf } from '@/lib/initials';
import type { ProjectMember, ProjectRole } from '@/types/api';

const ROLES: { value: ProjectRole; label: string; hint: string }[] = [
  { value: 'project_admin', label: 'Project admin', hint: 'Manage settings, sprints and members' },
  { value: 'developer', label: 'Developer', hint: 'Create and edit tasks' },
  { value: 'viewer', label: 'Viewer', hint: 'Read-only access' },
];

const ANY = '__any__';

function ProjectRoleBadge({ role }: { role: ProjectRole }) {
  switch (role) {
    case 'project_admin':
      return (
        <Badge className="bg-blue-600 text-white hover:bg-blue-600/90 dark:bg-blue-500 dark:text-white font-semibold shadow-xs">
          Project admin
        </Badge>
      );
    case 'developer':
      return (
        <Badge className="bg-purple-600 text-white hover:bg-purple-600/90 dark:bg-purple-500 dark:text-white font-medium shadow-xs">
          Developer
        </Badge>
      );
    case 'viewer':
    default:
      return (
        <Badge className="bg-cyan-600 text-white hover:bg-cyan-600/90 dark:bg-cyan-500 dark:text-white font-medium shadow-xs">
          Viewer
        </Badge>
      );
  }
}

export function ProjectMembersPage() {
  const { slug = '', key = '' } = useParams();
  const { members, addMember, updateMemberRole, removeMember } = useProjectStore();
  const workspaceMembers = useCurrentWorkspaceStore((s) => s.members);
  const myRole = useMyProjectRole();
  const canManage = myRole === 'project_admin';

  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<ProjectRole>('developer');
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState(ANY);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);

  // Only workspace members can be added to a project — the server rejects
  // anyone else with a 400, so they never appear in the picker.
  const addable = useMemo(() => {
    const existing = new Set(members.map((m) => m.userId));
    return workspaceMembers.filter((m) => !existing.has(m.userId) && m.state === 'active');
  }, [members, workspaceMembers]);

  const adminCount = members.filter((m) => m.role === 'project_admin').length;

  const hasFilters = filter.trim() !== '' || roleFilter !== ANY;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return members.filter(
      (m) =>
        (!q || [m.fullName, m.displayName, m.email].some((v) => v?.toLowerCase().includes(q))) &&
        (roleFilter === ANY || m.role === roleFilter),
    );
  }, [members, filter, roleFilter]);

  const onAdd = async () => {
    if (!addUserId) return;
    setBusy('add');
    try {
      await addMember(slug, key, addUserId, addRole);
      setAddUserId('');
      toast.success('Member added to project');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the member.');
    } finally {
      setBusy(null);
    }
  };

  const onRoleChange = async (userId: string, role: ProjectRole) => {
    setBusy(userId);
    try {
      await updateMemberRole(slug, key, userId, role);
      toast.success('Role updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the role.');
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async (userId: string, name: string) => {
    setBusy(userId);
    try {
      await removeMember(slug, key, userId);
      toast.success(`${name} removed from the project`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove the member.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Project members"
        description={
          canManage
            ? 'Workspace owners and admins always have project admin access, whether or not they are listed here.'
            : 'People with access to this project.'
        }
      />

      {canManage ? (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label htmlFor="add-member" className="mb-1.5 block text-sm text-foreground">
                Add a workspace member
              </label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger id="add-member" className="w-full">
                  <SelectValue placeholder={addable.length ? 'Choose a person' : 'Everyone is already a member'} />
                </SelectTrigger>
                <SelectContent>
                  {addable.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.displayName || m.fullName} — {m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <label htmlFor="add-role" className="mb-1.5 block text-sm text-foreground">
                Role
              </label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as ProjectRole)}>
                <SelectTrigger id="add-role" className="w-full">
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
            </div>

            <Button onClick={() => void onAdd()} disabled={!addUserId || busy === 'add'}>
              <UserPlusIcon className="size-4" aria-hidden="true" />
              Add
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
          aria-label="Filter project members"
          className="max-w-xs"
        />

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by role">
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

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilter('');
              setRoleFilter(ANY);
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

      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead className="w-44">Role</TableHead>
                {canManage ? <TableHead className="w-16 text-right"><span className="sr-only">Actions</span></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 3 : 2} className="h-24 text-center text-muted-foreground">
                    {members.length === 0
                      ? 'No one has been added to this project yet.'
                      : 'No member matches that search.'}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((member) => {
                  const name = member.displayName || member.fullName;
                  const isLastAdmin = member.role === 'project_admin' && adminCount === 1;
                  return (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <div className="flex items-center gap-3.5">
                          <Avatar className="size-8">
                            {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="text-xs">{initialsOf(name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{name}</p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <ProjectRoleBadge role={member.role} />
                        {isLastAdmin ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Sole admin
                          </p>
                        ) : null}
                      </TableCell>

                      {canManage ? (
                        <TableCell className="text-right">
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
                              <DropdownMenuLabel>Role</DropdownMenuLabel>
                              <DropdownMenuRadioGroup
                                value={member.role}
                                onValueChange={(val) => void onRoleChange(member.userId, val as ProjectRole)}
                              >
                                {ROLES.map((r) => (
                                  <DropdownMenuRadioItem
                                    key={r.value}
                                    value={r.value}
                                    disabled={isLastAdmin && r.value !== 'project_admin'}
                                    className="cursor-pointer"
                                  >
                                    {r.label}
                                  </DropdownMenuRadioItem>
                                ))}
                              </DropdownMenuRadioGroup>

                              {!isLastAdmin ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
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
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation dialog for member removal */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {memberToRemove?.displayName || memberToRemove?.fullName} from this project?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They keep their workspace membership and can be added back later.
              Tasks assigned to them stay assigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs"
              onClick={() => {
                if (memberToRemove) {
                  const name = memberToRemove.displayName || memberToRemove.fullName || 'Member';
                  void onRemove(memberToRemove.userId, name);
                  setMemberToRemove(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
