import { useState } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useAuthStore } from '@/store/auth';
import { apiFetch } from '@/lib/api';

export function DeleteAccountCard() {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  if (!user) return null;

  const onDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch('/auth/me', { method: 'DELETE' });
      toast.success('Account deleted successfully');
      logout();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete your account.');
      setDeleting(false);
    }
  };

  return (
    <Card className="ring-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
        <CardDescription>
          Deleting your account is permanent. It will instantly revoke all sessions and remove your access to all workspaces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog onOpenChange={(open) => !open && setConfirmText('')}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleting}>
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. To confirm, type your email address below.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user.email}
              aria-label={`Type ${user.email} to confirm`}
            />

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={confirmText !== user.email || deleting}
                onClick={(e) => {
                  if (confirmText !== user.email) {
                    e.preventDefault();
                    return;
                  }
                  void onDelete();
                }}
              >
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
