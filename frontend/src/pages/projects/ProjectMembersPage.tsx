import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlusIcon } from 'lucide-react';

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
import { useProjectStore, useMyProjectRole } from '@/store/projectStore';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { initialsOf } from '@/lib/initials';
import type { ProjectRole } from '@/types/api';

const ROLES: { value: ProjectRole; label: string; hint: string }[] = [
  { value: 'project_admin', label: 'Project admin', hint: 'Manage settings, sprints and members' },
  { value: 'developer', label: 'Developer', hint: 'Create and edit tasks' },
  { value: 'viewer', label: 'Viewer', hint: 'Read-only access' },
];

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

  // Only workspace members can be added to a project — the server rejects
  // anyone else with a 400, so they never appear in the picker.
  const addable = useMemo(() => {
    const existing = new Set(members.map((m) => m.userId));
    return workspaceMembers.filter((m) => !existing.has(m.userId) && m.state === 'active');
  }, [members, workspaceMembers]);

  const adminCount = members.filter((m) => m.role === 'project_admin').length;

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.fullName, m.displayName, m.email].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [members, filter]);

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
      // The server refuses to demote the last project admin.
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

      <div className="mb-3 flex items-center justify-between gap-3">
        <Input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or email"
          aria-label="Filter project members"
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
                {canManage ? <TableHead className="w-24" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 3 : 2} className="text-center text-muted-foreground">
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
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="text-xs">{initialsOf(name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-foreground">{name}</p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {canManage ? (
                          <Select
                            value={member.role}
                            onValueChange={(v) => void onRoleChange(member.userId, v as ProjectRole)}
                            disabled={busy === member.userId || isLastAdmin}
                          >
                            <SelectTrigger className="w-44">
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
                          <Badge variant="outline">{member.role.replace('_', ' ')}</Badge>
                        )}
                        {isLastAdmin ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            The last project admin cannot be demoted.
                          </p>
                        ) : null}
                      </TableCell>

                      {canManage ? (
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy === member.userId || isLastAdmin}
                              >
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {name} from this project?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  They keep their workspace membership and can be added back later.
                                  Tasks assigned to them stay assigned.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void onRemove(member.userId, name)}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
    </PageShell>
  );
}
