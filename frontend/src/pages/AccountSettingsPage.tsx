import { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { useToast } from '../hooks/useToast.js';
import { useAuthStore } from '../store/auth.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const AccountSettingsPage = () => {
  const { user } = useAuthStore();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');

    if (newPassword !== confirmPassword) {
      setFieldError('New passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast.success('Password changed. Other sessions were signed out.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full bg-background border border-border rounded-md px-4 py-2.5 text-foreground focus:border-ring focus:ring-1 focus:ring-ring transition-colors h-auto';

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-background text-foreground">
      <div className="max-w-2xl relative">
        <h1 className="text-2xl font-bold text-foreground mb-1">Account Settings</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Signed in as <span className="text-foreground">{user?.email}</span>
        </p>

        {/* Change Password */}
        <Card className="[--card-spacing:--spacing(6)] bg-elevated/50 border border-border mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary-muted border border-primary-border">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Change Password</h2>
              <p className="text-xs text-muted-foreground">
                Changing your password signs out every other device.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Current Password
              </Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter your current password"
                required
              />
            </div>

            <div>
              <Label className="block text-sm font-medium text-muted-foreground mb-1.5">
                New Password
              </Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 8 characters"
                required
              />
              <p className="mt-1 text-xs text-subtle-foreground">
                Must include uppercase, lowercase, a number, and a special character.
              </p>
            </div>

            <div>
              <Label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Confirm New Password
              </Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter new password"
                required
              />
            </div>

            {fieldError && (
              <div className="rounded-lg bg-danger-muted border border-danger-border p-3 text-sm text-danger">
                {fieldError}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSaving}
              variant="default"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-semibold transition-colors disabled:opacity-60 h-auto"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Update Password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};