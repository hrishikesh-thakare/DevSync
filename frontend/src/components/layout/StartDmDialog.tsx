import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SearchIcon, MessageSquareIcon, Loader2Icon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MemberAvatar } from '@/components/MemberAvatar';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { useAuthStore } from '@/store/auth';
import { apiFetch } from '@/lib/api';
import type { WorkspaceMember } from '@/types/api';

interface StartDmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
}

export function StartDmDialog({ open, onOpenChange, slug }: StartDmDialogProps) {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.userId);
  const { members, fetchWorkspaceData } = useCurrentWorkspaceStore();
  const [search, setSearch] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);

  const eligibleMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => m.userId !== currentUserId && m.state === 'active')
      .filter((m) => {
        if (!q) return true;
        const name = (m.displayName || m.fullName).toLowerCase();
        const email = (m.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });
  }, [members, currentUserId, search]);

  const handleStartDm = async (member: WorkspaceMember) => {
    setStartingId(member.userId);
    try {
      const data = await apiFetch(`/workspaces/${slug}/channels`, {
        method: 'POST',
        body: JSON.stringify({ type: 'dm', memberIds: [member.userId] }),
      });
      await fetchWorkspaceData(slug);
      onOpenChange(false);
      navigate(`/w/${slug}/channels/${data.channel.channelId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start conversation.');
    } finally {
      setStartingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New direct message</DialogTitle>
          <DialogDescription>
            Search and select a workspace member to start chatting.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-2">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto -mx-1 px-1 divide-y divide-border/30">
          {eligibleMembers.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {search.trim() ? 'No members match your search' : 'No other members in this workspace yet'}
            </div>
          ) : (
            eligibleMembers.map((member) => {
              const name = member.displayName || member.fullName;
              const isStarting = startingId === member.userId;
              return (
                <button
                  key={member.userId}
                  type="button"
                  disabled={Boolean(startingId)}
                  onClick={() => void handleStartDm(member)}
                  className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-left transition-colors hover:bg-accent/80 focus-visible:bg-accent focus-visible:outline-hidden disabled:opacity-60 cursor-pointer"
                >
                  <MemberAvatar member={member} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono px-1 py-0 text-muted-foreground">
                        {member.role}
                      </Badge>
                    </div>
                    {member.statusText ? (
                      <p className="truncate text-xs text-muted-foreground">{member.statusText}</p>
                    ) : member.email ? (
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    ) : null}
                  </div>
                  {isStarting ? (
                    <Loader2Icon className="size-4 animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <MessageSquareIcon className="size-4 text-muted-foreground/60 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
