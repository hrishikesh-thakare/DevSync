import { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { useToast } from '../hooks/useToast.js';
import { useAuthStore } from '../store/auth.js';

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
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all';

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-gray-950 text-gray-200">
      <div className="max-w-2xl relative">
        <h1 className="text-2xl font-bold text-white mb-1">Account Settings</h1>
        <p className="text-sm text-gray-400 mb-8">
          Signed in as <span className="text-gray-200">{user?.email}</span>
        </p>

        {/* Change Password */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <KeyRound className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Change Password</h2>
              <p className="text-xs text-gray-400">
                Changing your password signs out every other device.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter your current password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 8 characters"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Must include uppercase, lowercase, a number, and a special character.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter new password"
                required
              />
            </div>

            {fieldError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {fieldError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};