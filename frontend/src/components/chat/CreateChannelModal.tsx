import React, { useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useChatStore } from '../../store/useChatStore';
import { apiFetch } from '../../lib/api';
import { Loader2, Hash, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface CreateChannelModalProps {
  onClose: () => void;
  defaultType?: 'public' | 'private' | 'direct';
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ onClose, defaultType = 'public' }) => {
  const { currentWorkspace } = useWorkspaceStore();
  const { fetchChannels } = useChatStore();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [type, setType] = useState<'public' | 'private' | 'direct'>(defaultType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const data = await apiFetch(`/workspaces/${currentWorkspace.slug}/channels`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim().toLowerCase().replace(/\s+/g, '-'),
          type,
        }),
      });
      await fetchChannels();
      onClose();
      navigate(`/chat/${data.channel.channelId}`);
    } catch (err) {
      console.error('Failed to create channel:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where your team communicates. They're best when organized around a topic — #marketing, for example.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {type === 'public' ? <Hash className="h-4 w-4 text-subtle-foreground" /> : <Users className="h-4 w-4 text-subtle-foreground" />}
              </div>
              <Input
                id="channel-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-9"
                placeholder="e.g. plan-budget"
                autoFocus
                required
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Visibility
            </legend>
            <RadioGroup value={type} onValueChange={(v) => setType(v as 'public' | 'private')} className="gap-3">
              <label htmlFor="channel-visibility-public" className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${type === 'public' ? 'border-primary bg-primary-muted' : 'border-border bg-elevated/50 hover:border-border-strong'}`}>
                <RadioGroupItem value="public" id="channel-visibility-public" className="mt-1" />
                <div>
                  <div className="font-medium text-sm text-foreground">Public</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Anyone in the workspace can find and join this channel.</div>
                </div>
              </label>

              <label htmlFor="channel-visibility-private" className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${type === 'private' ? 'border-primary bg-primary-muted' : 'border-border bg-elevated/50 hover:border-border-strong'}`}>
                <RadioGroupItem value="private" id="channel-visibility-private" className="mt-1" />
                <div>
                  <div className="font-medium text-sm text-foreground">Private</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Only invited members can view and join this channel.</div>
                </div>
              </label>
            </RadioGroup>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="min-w-[100px]"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChannelModal;