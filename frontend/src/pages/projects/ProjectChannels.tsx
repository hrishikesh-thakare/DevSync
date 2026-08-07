import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hash, Plus, X, Loader2, Lock } from 'lucide-react';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';


interface ProjectChannel {
  channelId: string;
  projectId?: string | null;
  name: string;
  type: string;
}

export const ProjectChannels = () => {
  const { slug, key } = useParams();
  const navigate = useNavigate();
  const { projects, isAdmin } = useCurrentWorkspaceStore();
  const [channels, setChannels] = useState<ProjectChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('public');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  const currentProject = projects.find(p => p.key === key?.toUpperCase());

  const fetchProjectChannels = useCallback(async () => {
    if (!slug || !currentProject) return;
    await Promise.resolve();
    try {
      const { apiFetch } = await import('../../lib/api.js');
      // The backend doesn't have a specific GET /projects/:projectId/channels,
      // but we can fetch all workspace channels and filter by projectId
      const data = await apiFetch(`/workspaces/${slug}/channels`);
      const projectChannels = data.channels.filter((c: ProjectChannel) => c.projectId === currentProject?.projectId);
      setChannels(projectChannels);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [slug, currentProject]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (isMounted) {
        fetchProjectChannels();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fetchProjectChannels]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName || !slug || !currentProject) return;
    setIsCreatingChannel(true);
    try {
      const { apiFetch } = await import('../../lib/api.js');
      await apiFetch(`/workspaces/${slug}/channels`, {
        method: 'POST',
        body: JSON.stringify({ 
          name: newChannelName, 
          type: newChannelType,
          projectId: currentProject.projectId
        })
      });
      setShowModal(false);
      setNewChannelName('');
      fetchProjectChannels();
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message || 'Failed to create channel.');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  if (!currentProject) return null;

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-gray-950 text-gray-200">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Project Channels</h2>
          <p className="text-sm text-gray-400">Dedicated chat channels for {currentProject.name}.</p>
        </div>
        {isAdmin() && (
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-gray-400 hover:bg-white text-white font-bold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Channel
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Create Project Channel</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateChannel} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Channel Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">#</span>
                  <input 
                    type="text" 
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-8 pr-4 py-2 text-white focus:outline-none focus:border-white transition-colors font-mono text-sm"
                    placeholder="frontend-dev"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Visibility</label>
                <select 
                  value={newChannelType}
                  onChange={e => setNewChannelType(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white transition-colors"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-medium">Cancel</button>
                <button type="submit" disabled={isCreatingChannel} className="px-6 py-2 bg-white text-gray-950 hover:bg-gray-200 font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center">
                  {isCreatingChannel && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>
      ) : channels.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
          <Hash className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">No project channels</h3>
          <p className="text-sm text-gray-500 mt-1">Create a channel to discuss this project specifically.</p>
        </div>
      ) : (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="px-6 py-4">Channel Name</th>
                <th className="px-6 py-4">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {channels.map(channel => (
                <tr 
                  key={channel.channelId} 
                  className="hover:bg-gray-800/30 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/w/${slug}/channels/${channel.channelId}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {channel.type === 'private' ? (
                        <Lock className="w-4 h-4 text-gray-500 mr-2" />
                      ) : (
                        <Hash className="w-4 h-4 text-gray-500 mr-2" />
                      )}
                      <span className="font-medium text-gray-200 group-hover:text-white transition-colors">{channel.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500 capitalize">{channel.type}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
