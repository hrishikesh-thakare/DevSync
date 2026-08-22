import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hash, Plus, Loader2, Lock } from 'lucide-react';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


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
    <div className="h-full overflow-y-auto p-8 font-sans bg-background text-foreground">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-heading font-[590] text-foreground mb-1">Project Channels</h2>
          <p className="text-ui text-muted-foreground">Dedicated chat channels for {currentProject.name}.</p>
        </div>
        {isAdmin() && (
          <Button 
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground font-[590] rounded-md transition-colors"
            variant="primary" size="default"
          >
            <Plus className="w-4 h-4 mr-2" strokeWidth={1.75} />
            Create Channel
          </Button>
        )}
      </div>

      {showModal && (
        <Dialog open onOpenChange={(open) => { if (!open) setShowModal(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Project Channel</DialogTitle>
              <DialogDescription>Add a channel scoped to this project.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pc-channel-name">Channel Name</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground" aria-hidden="true">#</span>
                  <Input
                    id="pc-channel-name"
                    type="text"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="pl-8 font-mono text-ui"
                    placeholder="frontend-dev"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pc-channel-type">Visibility</Label>
                <Select value={newChannelType} onValueChange={setNewChannelType}>
                  <SelectTrigger id="pc-channel-type" className="w-full bg-elevated">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" disabled={isCreatingChannel}>
                  {isCreatingChannel && <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={1.75} />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" strokeWidth={1.5} /></div>
      ) : channels.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Hash className="w-12 h-12 text-subtle-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="text-heading font-[510] text-foreground">No project channels</h3>
          <p className="text-ui text-subtle-foreground mt-1">Create a channel to discuss this project specifically.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted text-caption uppercase tracking-wider text-subtle-foreground font-[590]">
                <th className="px-6 py-4">Channel Name</th>
                <th className="px-6 py-4">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {channels.map(channel => (
                <tr 
                  key={channel.channelId} 
                  className="hover:bg-hover transition-colors cursor-pointer group"
                  onClick={() => navigate(`/w/${slug}/channels/${channel.channelId}`)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {channel.type === 'private' ? (
                        <Lock className="w-4 h-4 text-subtle-foreground mr-2" strokeWidth={1.75} />
                      ) : (
                        <Hash className="w-4 h-4 text-subtle-foreground mr-2" strokeWidth={1.75} />
                      )}
                      <span className="font-[510] text-foreground group-hover:text-primary transition-colors">{channel.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-ui text-subtle-foreground capitalize">{channel.type}</span>
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
