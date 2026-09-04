import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2Icon, LogOutIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { workspaceKeys } from '@/store/workspaceStore';

/**
 * Self-service `DELETE /workspaces/:slug/members/me`.
 *
 * The owner is refused with a 400 — they have to transfer ownership or delete
 * the workspace instead — so the button is simply not offered to them. Leaving
 * flips the membership to `deactivated` rather than deleting it, which is why
 * the workspace can be granted back later by re-inviting.
 */
export function LeaveWorkspaceButton({ slug, canLeave }: { slug: string; canLeave: boolean }) {
  const navigate = useNavigate();
  const name = useCurrentWorkspaceStore((s) => s.name);
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);

  if (!canLeave) return null;

  const leave = async () => {
    setLeaving(true);
    try {
      await apiFetch(`/workspaces/${slug}/members/me`, { method: 'DELETE' });
      toast.success(`You left ${name}`);
      // Every route under /w/:slug now 403s, so leave the shell before the
      // picker's list is refreshed underneath it.
      navigate('/workspaces', { replace: true });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not leave this workspace.');
      setLeaving(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={leaving}>
          {leaving ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOutIcon className="size-4" aria-hidden="true" />
          )}
          Leave workspace
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            You will lose access to its projects, tasks and channels straight away. An owner or
            admin can invite you back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void leave();
            }}
          >
            Leave workspace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
