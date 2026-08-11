import React, { useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { Bell, X, Save } from 'lucide-react';

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
      alert('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-500/10 p-2 rounded-lg">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Notification Settings</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Filtering & Throttling</h4>
            <div className="space-y-4">
              <label className="flex items-start cursor-pointer group">
                <div className="flex items-center h-6">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                    checked={notifyOnlyMentions}
                    onChange={(e) => setNotifyOnlyMentions(e.target.checked)}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <span className="font-medium text-gray-200 group-hover:text-white transition-colors">Only notify for @mentions</span>
                  <p className="text-gray-500 mt-1">Mute all general channel and task updates unless you are explicitly mentioned.</p>
                </div>
              </label>

              <label className="flex items-start cursor-pointer group">
                <div className="flex items-center h-6">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                    checked={muteGithubBot}
                    onChange={(e) => setMuteGithubBot(e.target.checked)}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <span className="font-medium text-gray-200 group-hover:text-white transition-colors">Mute GitHub bot spam</span>
                  <p className="text-gray-500 mt-1">Stop receiving noisy notifications for PR creations, commits, and CI/CD builds.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-800 bg-gray-900/50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-2 px-5 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all shadow-sm shadow-blue-900/20"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
