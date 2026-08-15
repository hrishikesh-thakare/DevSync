import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { Save, AlertTriangle, Image as ImageIcon, X } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../hooks/useToast.js';
import { WorkspaceAuditLogs } from './WorkspaceAuditLogs.js';

export const WorkspaceSettings = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { name, isOwner, isAdmin } = useCurrentWorkspaceStore();
  const toast = useToast();

  // RBAC Guard: admin or owner
  useEffect(() => {
    if (!isAdmin()) {
      navigate(`/w/${slug}`, { replace: true });
    }
  }, [isAdmin, slug, navigate]);

  const [wsName, setWsName] = useState(name || '');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiFetch(`/workspaces/${slug}`, {
        method: 'PUT',
        body: JSON.stringify({ name: wsName, description }),
      });
      toast.success('Workspace updated successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workspace.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`/workspaces/${slug}`, { method: 'DELETE' });
      navigate('/workspaces');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workspace.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-gray-950 text-gray-200">
      <div className="max-w-3xl relative">
        <h1 className="text-2xl font-bold text-white mb-8">Workspace Settings</h1>

        {/* General Settings */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-6">General Information</h2>

          <div className="space-y-6">
            <div className="flex items-start space-x-6">
              <div className="shrink-0">
                <div className="w-20 h-20 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:border-white/50 hover:bg-gray-700 transition-colors group relative overflow-hidden">
                  <ImageIcon className="w-8 h-8 text-gray-500 group-hover:opacity-0 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-semibold">Change</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Workspace Name</label>
                  <input 
                    type="text" 
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-800/60">
              <button onClick={handleSave} disabled={isSaving} className="flex items-center px-5 py-2.5 bg-white hover:bg-gray-200 text-gray-950 text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Audit Logs */}
        {isOwner() && <WorkspaceAuditLogs />}

        {/* Danger Zone */}
        {isOwner() && (
          <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-6">
            <h2 className="text-lg font-bold text-red-500 mb-2 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Danger Zone
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Deleting this workspace will permanently remove all projects, channels, tasks, and messages associated with it. This action cannot be undone.
            </p>
            
            <div className="flex items-center justify-between p-4 bg-gray-950 border border-red-500/20 rounded-lg">
              <div>
                <h4 className="font-semibold text-gray-200">Delete Workspace</h4>
                <p className="text-xs text-gray-500">Permanently remove everything.</p>
              </div>
              <button onClick={() => setDeleteModalOpen(true)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-colors">
                Delete Workspace
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-xl shadow-2xl p-6 relative">
              <button onClick={() => setDeleteModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center mb-4 text-red-500">
                <AlertTriangle className="w-6 h-6 mr-2" />
                <h2 className="text-xl font-bold">Delete Workspace</h2>
              </div>
              <p className="text-gray-300 text-sm mb-6">
                This action is permanent. Please type <span className="font-mono font-bold text-white bg-gray-800 px-1 py-0.5 rounded">DEVSYNC</span> to confirm.
              </p>
              <input 
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DEVSYNC"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 mb-6"
              />
              <div className="flex justify-end space-x-3">
                <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== 'DEVSYNC' || isDeleting}
                  className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
