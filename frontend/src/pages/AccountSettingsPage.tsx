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
      toast.error(err instanceof Error ? err.message : "Couldn't change your password. Check your current password and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full';

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-background text-foreground">
      <div className="max-w-2xl relative">
        <h1 className="text-h1 font-[590] text-foreground mb-1">Account Settings</h1>
        <p className="text-ui text-muted-foreground mb-8">
          Signed in as <span className="text-foreground">{user?.email}</span>
        </p>

        {/* Change Password */}
        <Card className="[--card-spacing:--spacing(6)] bg-elevated/50 border border-border mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary-muted border border-primary-border">
              <KeyRound className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-h2 font-[590] text-foreground">Change Password</h2>
              <p className="text-caption text-muted-foreground">
                Changing your password signs out every other device.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="accountsettingspage-current-password" className="block text-ui font-[510] text-muted-foreground mb-1.5">
                Current Password
              </Label>
              <Input
                id="accountsettingspage-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter your current password"
                required
              />
            </div>

            <div>
              <Label htmlFor="accountsettingspage-new-password" className="block text-ui font-[510] text-muted-foreground mb-1.5">
                New Password
              </Label>
              <Input
                id="accountsettingspage-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 8 characters"
                required
              />
              <p className="mt-1 text-caption text-subtle-foreground">
                Must include uppercase, lowercase, a number, and a special character.
              </p>
            </div>

            <div>
              <Label htmlFor="accountsettingspage-confirm-new-password" className="block text-ui font-[510] text-muted-foreground mb-1.5">
                Confirm New Password
              </Label>
              <Input
                id="accountsettingspage-confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter new password"
                required
              />
            </div>

            {fieldError && (
              <div className="rounded-lg bg-danger-muted border border-danger-border p-3 text-ui text-danger">
                {fieldError}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSaving}
              variant="primary"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-ui font-[590] transition-colors disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
              )}
              Update Password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};