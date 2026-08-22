import React, { useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { Bell, Save, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface NotificationSettingsModalProps {
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ onClose }) => {
  const { user, updatePreferences } = useAuthStore();
  const prefs = user?.preferences || {};

  const [notifyOnlyMentions, setNotifyOnlyMentions] = useState(!!prefs.notifyOnlyMentions);
  const [muteGithubBot, setMuteGithubBot] = useState(!!prefs.muteGithubBot);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({
        notifyOnlyMentions,
        muteGithubBot,
      });
      onClose();
    } catch {
      alert("Couldn't save your notification preferences. Try again in a moment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-info/10 p-1.5 rounded-lg">
              <Bell className="w-4 h-4 text-info" strokeWidth={1.75} />
            </span>
            Notification Settings
          </DialogTitle>
          <DialogDescription>
            Control how DevSync notifies you about activity in your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-ui font-[510] text-muted-foreground uppercase">
              Filtering &amp; Throttling
            </legend>
            <label className="flex items-start justify-between gap-4 cursor-pointer group">
              <div className="text-ui">
                <span className="font-[510] text-foreground group-hover:text-foreground transition-colors">Only notify for @mentions</span>
                <p className="text-subtle-foreground mt-1">Mute all general channel and task updates unless you are explicitly mentioned.</p>
              </div>
              <Switch
                checked={notifyOnlyMentions}
                onCheckedChange={setNotifyOnlyMentions}
                aria-label="Only notify for @mentions"
              />
            </label>

            <label className="flex items-start justify-between gap-4 cursor-pointer group">
              <div className="text-ui">
                <span className="font-[510] text-foreground group-hover:text-foreground transition-colors">Mute GitHub bot spam</span>
                <p className="text-subtle-foreground mt-1">Stop receiving noisy notifications for PR creations, commits, and CI/CD builds.</p>
              </div>
              <Switch
                checked={muteGithubBot}
                onCheckedChange={setMuteGithubBot}
                aria-label="Mute GitHub bot spam"
              />
            </label>
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} /> : <Save className="w-4 h-4" strokeWidth={1.75} />}
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};