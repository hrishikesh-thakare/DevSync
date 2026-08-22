import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, User, UserPlus, MoreHorizontal, Mail, Loader2 } from 'lucide-react';
import clsx from 'clsx';

import { useAuthStore } from '../../store/auth.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import type { WorkspaceMember } from '../../store/currentWorkspace.js';
import type { ProjectMember } from '../../store/boardStore.js';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * `GET /workspaces/:slug/projects/:key/members` returns the board's
 * `ProjectMember` shape plus the address, which this table renders under the
 * name. The board never shows it, which is why it isn't on the shared type.
 */
interface ProjectMemberRow extends ProjectMember {
  email: string;
}

export const ProjectMembers = () => {
  const { slug, key } = useParams();
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [targetRole, setTargetRole] = useState('developer');
  const [isAdding, setIsAdding] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const currentUser = useAuthStore(state => state.user);
  const { isAdmin } = useCurrentWorkspaceStore();
  const toast = useToast();
  const confirm = useConfirm();
  
  const myMembership = members.find(m => m.userId === currentUser?.userId);
  const isProjectAdmin = myMembership?.role === 'project_admin';
  const canAddMember = isAdmin() || isProjectAdmin;

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const { apiFetch } = await import('../../lib/api.js');
        const data = await apiFetch(`/workspaces/${slug}/projects/${key}/members`);
        setMembers(data.members || []);
      } catch (err) {
        console.error(err);
      }
    };
    if (slug && key) fetchMembers();
  }, [slug, key]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail) return;
    setIsAdding(true);
    try {
      const { apiFetch } = await import('../../lib/api.js');
      // First fetch workspace members to find the userId by email
      const wsData = await apiFetch(`/workspaces/${slug}/members`);
      const targetUser = wsData.members?.find((m: WorkspaceMember) => m.email.toLowerCase() === targetEmail.toLowerCase());
      if (!targetUser) {
        toast.error("User not found in this workspace. Invite them to the workspace first.");
        setIsAdding(false);
        return;
      }

      // Now add them to the project
      await apiFetch(`/workspaces/${slug}/projects/${key}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: targetUser.userId, role: targetRole })
      });
      
      setShowModal(false);
      setTargetEmail('');
      // Re-fetch project members
      const data = await apiFetch(`/workspaces/${slug}/projects/${key}/members`);
      setMembers(data.members || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't add project member. Try again in a moment.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!(await confirm('Remove this member from the project?'))) return;
    try {
      const { apiFetch } = await import('../../lib/api.js');
      await apiFetch(`/workspaces/${slug}/projects/${key}/members/${userId}`, { method: 'DELETE' });
      const data = await apiFetch(`/workspaces/${slug}/projects/${key}/members`);
      setMembers(data.members || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove member. Try again in a moment.");
    }
    setActiveDropdown(null);
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const { apiFetch } = await import('../../lib/api.js');
      await apiFetch(`/workspaces/${slug}/projects/${key}/members/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      });
      const data = await apiFetch(`/workspaces/${slug}/projects/${key}/members`);
      setMembers(data.members || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't update role. Try again in a moment.");
    }
    setActiveDropdown(null);
  };

  const isOnlyAdmin = isProjectAdmin && members.filter(m => m.role === 'project_admin').length <= 1;

  const canActOn = (member: ProjectMemberRow) => {
    if (isAdmin()) return true;
    if (member.userId === currentUser?.userId) return true; // Anyone can act on themselves (to leave)
    if (isProjectAdmin) return member.role !== 'project_admin';
    return false;
  };

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-background text-foreground">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-h2 font-[590] text-foreground mb-1">Project Members</h2>
          <p className="text-ui text-muted-foreground">Manage who has access to {key}.</p>
        </div>
        {canAddMember && (
          <Button 
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 font-[590] rounded-md transition-colors"
            variant="primary" size="default"
          >
            <UserPlus className="w-4 h-4 mr-2" strokeWidth={1.75} />
            Add Member
          </Button>
        )}
      </div>

      {showModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowModal(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Project Member</DialogTitle>
              <DialogDescription>
                Grant access to this project for a workspace member.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pm-email">Workspace Member Email</Label>
                <Input
                  id="pm-email"
                  type="email"
                  value={targetEmail}
                  onChange={e => setTargetEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
                <p className="text-caption text-subtle-foreground mt-1">User must already be a member of the workspace.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pm-role">Project Role</Label>
                <Select value={targetRole} onValueChange={setTargetRole}>
                  <SelectTrigger id="pm-role" className="w-full bg-elevated">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project_admin">Project Admin</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isAdding}>
                  {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.75} />}
                  Add to Project
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted text-caption uppercase text-subtle-foreground font-[590]">
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Project Role</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map(member => (
              <tr key={member.userId} className="hover:bg-hover transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-hover flex items-center justify-center text-foreground font-[590] shadow-sm">
                      {member.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-[590] text-foreground">{member.fullName}</div>
                      <div className="text-caption text-subtle-foreground flex items-center mt-0.5">
                        <Mail className="w-3 h-3 mr-1" strokeWidth={1.75} />
                        {member.email}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center text-ui">
                    {member.role === 'project_admin' && <Shield className="w-4 h-4 text-foreground mr-2" strokeWidth={1.75} />}
                    {member.role === 'developer' && <Shield className="w-4 h-4 text-foreground mr-2" strokeWidth={1.75} />}
                    {member.role === 'viewer' && <User className="w-4 h-4 text-subtle-foreground mr-2" strokeWidth={1.75} />}
                    <span className={clsx("capitalize", 
                      member.role === 'project_admin' ? 'text-foreground font-[510]' : 
                      member.role === 'developer' ? 'text-foreground font-[510]' : 'text-foreground'
                    )}>
                      {member.role.replace('_', ' ')}
                    </span>
                  </div>
                </td>

                <td className="px-6 py-4 text-right relative">
                  {canActOn(member) && (
                    <DropdownMenu
                      open={activeDropdown === member.userId}
                      onOpenChange={(open) => setActiveDropdown(open ? member.userId : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          className="p-1.5 text-subtle-foreground hover:text-foreground hover:bg-hover rounded transition-colors"
                          aria-label={`Actions for ${member.fullName}`}
                          size="icon" variant="ghost"
                        >
                          <MoreHorizontal className="w-5 h-5" strokeWidth={1.75} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {member.userId === currentUser?.userId ? (
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={isOnlyAdmin}
                            onSelect={() => !isOnlyAdmin && handleRemove(member.userId)}
                          >
                            Leave Project
                          </DropdownMenuItem>
                        ) : (
                          <>
                            {member.role !== 'project_admin' && (
                              <DropdownMenuItem onSelect={() => handleChangeRole(member.userId, 'project_admin')}>
                                Make Project Admin
                              </DropdownMenuItem>
                            )}
                            {member.role !== 'developer' && (
                              <DropdownMenuItem onSelect={() => handleChangeRole(member.userId, 'developer')}>
                                Make Developer
                              </DropdownMenuItem>
                            )}
                            {member.role !== 'viewer' && (
                              <DropdownMenuItem onSelect={() => handleChangeRole(member.userId, 'viewer')}>
                                Make Viewer
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => handleRemove(member.userId)}
                            >
                              Remove from Project
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
