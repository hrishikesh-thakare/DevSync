import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { Shield, User, UserPlus, MoreHorizontal, Mail, Loader2, X, Search, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { useToast } from '../../hooks/useToast.js';
import { useConfirm } from '../../hooks/useConfirm.js';

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

  const fetchMembers = async () => {
    try {
      const data = await apiFetch(`/workspaces/${slug}/members`);
      setMembers(data.members || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (slug) fetchMembers();
  }, [slug]);

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
    } catch (err: any) {
      toast.error(err.message || 'Failed to invite member.');
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role.');
    }
    setActiveDropdown(null);
  };

  const handleRemove = async (userId: string) => {
    if (!(await confirm('Remove this member from the workspace?'))) return;
    try {
      await apiFetch(`/workspaces/${slug}/members/${userId}`, { method: 'DELETE' });
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member.');
    }
    setActiveDropdown(null);
  };

  const handleLeave = async () => {
    if (!(await confirm('Leave this workspace? You can only rejoin if an owner or admin invites you again.'))) return;
    try {
      await apiFetch(`/workspaces/${slug}/members/me`, { method: 'DELETE' });
      toast.success('You have left the workspace.');
      navigate('/workspaces');
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave workspace.');
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
    <div className="h-full overflow-y-auto p-8 font-sans bg-gray-950 text-gray-200">
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Workspace Members</h1>
          <p className="text-sm text-gray-400">Manage access and roles for your team. {members.length} total members.</p>
        </div>
        {/* Only admin+ can invite */}
        <div className="flex items-center space-x-3">
          {!isOwner() && (
            <button 
              onClick={handleLeave}
              className="flex items-center px-4 py-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-semibold"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave Workspace
            </button>
          )}
          {isAdmin() && (
            <button 
              onClick={() => setShowModal(true)}
              className="flex items-center px-4 py-2 bg-white hover:bg-gray-300 text-gray-950 font-bold rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Members
            </button>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-white/50"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none"
        >
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none"
        >
          <option value="all">All States</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Invite Member</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                  placeholder="name@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                <select 
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-medium">Cancel</button>
                <button type="submit" disabled={isInviting} className="px-6 py-2 bg-white text-gray-950 hover:bg-gray-200 font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center">
                  {isInviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filtered.map(member => (
                <tr key={member.userId} className="hover:bg-gray-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center text-white font-bold shadow-sm">
                        {member.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-200">
                          {member.fullName}
                          {member.userId === currentUser?.userId && <span className="text-xs text-gray-500 ml-2">(you)</span>}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center mt-0.5">
                          <Mail className="w-3 h-3 mr-1" />
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className={clsx(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border",
                      member.state === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                      member.state === 'invited' ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                      "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {member.state}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm">
                      {member.role === 'owner' && <Shield className="w-4 h-4 text-yellow-400 mr-2" />}
                      {member.role === 'admin' && <Shield className="w-4 h-4 text-blue-400 mr-2" />}
                      {member.role === 'member' && <User className="w-4 h-4 text-gray-500 mr-2" />}
                      <span className={clsx("capitalize", member.role === 'owner' ? 'text-yellow-400 font-medium' : 'text-gray-300')}>
                        {member.role}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-500">
                    {member.joinedAt ? format(new Date(member.joinedAt), 'MMM d, yyyy') : '—'}
                  </td>

                  <td className="px-6 py-4 text-right relative">
                    {canActOn(member) && (
                      <div className="relative inline-block">
                        <button 
                          onClick={() => setActiveDropdown(activeDropdown === member.userId ? null : member.userId)}
                          className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>

                        {activeDropdown === member.userId && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                            {/* Change Role options */}
                            {isOwner() && member.role !== 'admin' && (
                              <button onClick={() => handleChangeRole(member.userId, 'admin')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                                Promote to Admin
                              </button>
                            )}
                            {isOwner() && member.role === 'admin' && (
                              <button onClick={() => handleChangeRole(member.userId, 'member')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
                                Demote to Member
                              </button>
                            )}
                            {/* Remove */}
                            <button onClick={() => handleRemove(member.userId)} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800 transition-colors border-t border-gray-800">
                              Remove from Workspace
                            </button>
                          </div>
                        )}
                      </div>
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
