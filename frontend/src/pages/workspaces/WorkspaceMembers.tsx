import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { Shield, User, UserPlus, MoreHorizontal, Mail, Loader2, Search, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';
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
import { Badge } from '@/components/ui/badge';

interface Member {
  userId: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'member';
  state: 'active' | 'invited' | 'deactivated';
  joinedAt: string;
}

export const WorkspaceMembers = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { myRole, isAdmin, isOwner } = useCurrentWorkspaceStore();
  const { user: currentUser } = useAuthStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [isInviting, setIsInviting] = useState(false);

  // Filters
  const [filterRole, setFilterRole] = useState('all');
  const [filterState, setFilterState] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Action dropdown
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!slug) return;
    try {
      const data = await apiFetch(`/workspaces/${slug}/members`);
      setMembers(data.members || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    let isCancelled = false;
    const init = async () => {
      await Promise.resolve();
      if (!isCancelled) {
        fetchMembers();
      }
    };
    init();
    return () => {
      isCancelled = true;
    };
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      await apiFetch(`/workspaces/${slug}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      setShowModal(false);
      setInviteEmail('');
      fetchMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite member.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await apiFetch(`/workspaces/${slug}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      });
      fetchMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role.');
    }
    setActiveDropdown(null);
  };

  const handleRemove = async (userId: string) => {
    if (!(await confirm('Remove this member from the workspace?'))) return;
    try {
      await apiFetch(`/workspaces/${slug}/members/${userId}`, { method: 'DELETE' });
      fetchMembers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member.');
    }
    setActiveDropdown(null);
  };

  const handleLeave = async () => {
    if (!(await confirm('Leave this workspace? You can only rejoin if an owner or admin invites you again.'))) return;
    try {
      await apiFetch(`/workspaces/${slug}/members/me`, { method: 'DELETE' });
      toast.success('You have left the workspace.');
      navigate('/workspaces');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave workspace.');
    }
  };

  // Can the current user take actions on a given member?
  const canActOn = (member: Member) => {
    if (member.userId === currentUser?.userId) return false; // Can't act on yourself
    if (isOwner()) return member.role !== 'owner'; // Owner can act on everyone except themselves
    if (myRole === 'admin') return member.role === 'member'; // Admin can only act on members
    return false;
  };

  // Filtered members
  let filtered = members;
  if (filterRole !== 'all') filtered = filtered.filter(m => m.role === filterRole);
  if (filterState !== 'all') filtered = filtered.filter(m => m.state === filterState);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(m => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-background text-foreground">
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-heading font-[590] text-foreground mb-1">Workspace Members</h1>
          <p className="text-ui text-muted-foreground">Manage access and roles for your team. {members.length} total members.</p>
        </div>
        {/* Only admin+ can invite */}
        <div className="flex items-center space-x-3">
          {!isOwner() && (
            <Button 
              onClick={handleLeave}
              variant="destructive"
              className="flex items-center px-4 py-2 border border-danger-border text-danger hover:bg-danger-muted rounded-md transition-colors font-[590] h-auto"
            >
              <LogOut className="w-4 h-4 mr-2" strokeWidth={1.75} />
              Leave Workspace
            </Button>
          )}
          {isAdmin() && (
            <Button 
              onClick={() => setShowModal(true)}
              variant="primary"
              className="flex items-center px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground font-[590] rounded-md transition-colors h-auto"
            >
              <UserPlus className="w-4 h-4 mr-2" strokeWidth={1.75} />
              Invite Members
            </Button>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-subtle-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
          <Input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-ui text-foreground focus:border-ring focus:ring-1 focus:ring-ring h-auto"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="bg-elevated">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterState} onValueChange={setFilterState}>
          <SelectTrigger className="bg-elevated">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invite Modal */}
      {showModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowModal(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
              <DialogDescription>
                Send an invite link to a new workspace member.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role" className="w-full bg-elevated">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isInviting}>
                  {isInviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.75} />}
                  Send Invite
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Members Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted text-caption uppercase tracking-wider text-subtle-foreground font-[590]">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(member => (
                <tr key={member.userId} className="hover:bg-hover transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-hover flex items-center justify-center text-foreground font-[590] shadow-sm">
                        {member.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-[590] text-foreground">
                          {member.fullName}
                          {member.userId === currentUser?.userId && <span className="text-caption text-subtle-foreground ml-2">(you)</span>}
                        </div>
                        <div className="text-caption text-subtle-foreground flex items-center mt-0.5">
                          <Mail className="w-3 h-3 mr-1" strokeWidth={1.75} />
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <Badge
                      variant={member.state === 'active' ? 'success' : member.state === 'invited' ? 'warning' : 'destructive'}
                      className="h-auto px-2 py-0.5 rounded uppercase font-[590] tracking-wide"
                    >
                      {member.state}
                    </Badge>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center text-ui">
                      {member.role === 'owner' && <Shield className="w-4 h-4 text-warning mr-2" strokeWidth={1.75} />}
                      {member.role === 'admin' && <Shield className="w-4 h-4 text-primary mr-2" strokeWidth={1.75} />}
                      {member.role === 'member' && <User className="w-4 h-4 text-subtle-foreground mr-2" strokeWidth={1.75} />}
                      <span className={clsx("capitalize", member.role === 'owner' ? 'text-warning font-[510]' : 'text-foreground')}>
                        {member.role}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-ui text-subtle-foreground">
                    {member.joinedAt ? format(new Date(member.joinedAt), 'MMM d, yyyy') : '—'}
                  </td>

                  <td className="px-6 py-4 text-right relative">
                    {canActOn(member) && (
                      <DropdownMenu
                        open={activeDropdown === member.userId}
                        onOpenChange={(open) => setActiveDropdown(open ? member.userId : null)}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            className="p-1.5 text-subtle-foreground hover:text-foreground hover:bg-hover rounded transition-colors h-auto w-auto"
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${member.fullName}`}
                          >
                            <MoreHorizontal className="w-5 h-5" strokeWidth={1.75} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {isOwner() && member.role !== 'admin' && (
                            <DropdownMenuItem onSelect={() => handleChangeRole(member.userId, 'admin')}>
                              Promote to Admin
                            </DropdownMenuItem>
                          )}
                          {isOwner() && member.role === 'admin' && (
                            <DropdownMenuItem onSelect={() => handleChangeRole(member.userId, 'member')}>
                              Demote to Member
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => handleRemove(member.userId)}
                          >
                            Remove from Workspace
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};
