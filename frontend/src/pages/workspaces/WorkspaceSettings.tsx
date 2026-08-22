import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { Save, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { useToast } from '../../hooks/useToast.js';
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
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update workspace.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`/workspaces/${slug}`, { method: 'DELETE' });
      navigate('/workspaces');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete workspace.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-background text-foreground">
      <div className="max-w-3xl relative">
        <h1 className="text-heading font-[590] text-foreground mb-8">Workspace Settings</h1>

        {/* General Settings */}
        <Card className="[--card-spacing:--spacing(6)] bg-elevated/50 border border-border mb-8">
          <h2 className="text-heading font-[590] text-foreground mb-6">General Information</h2>

          <div className="space-y-6">
            <div className="flex items-start space-x-6">
              <div className="shrink-0">
                <div className="w-20 h-20 rounded-lg bg-hover border border-border flex items-center justify-center cursor-pointer hover:border-strong hover:bg-hover transition-colors group relative overflow-hidden">
                  <ImageIcon className="w-8 h-8 text-subtle-foreground group-hover:opacity-0 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center bg-overlay opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-caption font-[590]">Change</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <Label className="block text-ui font-[510] text-muted-foreground mb-1.5">Workspace Name</Label>
                  <Input 
                    type="text" 
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-4 py-2.5 text-foreground focus:border-ring focus:ring-1 focus:ring-ring transition-colors h-auto"
                  />
                </div>
                <div>
                  <Label className="block text-ui font-[510] text-muted-foreground mb-1.5">Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-background border border-border rounded-md px-4 py-2.5 text-foreground focus:border-ring focus:ring-1 focus:ring-ring transition-colors h-auto"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button onClick={handleSave} disabled={isSaving} variant="primary" className="flex items-center px-5 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground text-ui font-[590] rounded-md transition-colors disabled:opacity-50 h-auto">
                <Save className="w-4 h-4 mr-2" strokeWidth={1.75} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        {isOwner() && (
          <div className="border border-danger-border bg-danger-muted rounded-lg p-6">
            <h2 className="text-heading font-[590] text-danger mb-2 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" strokeWidth={1.75} />
              Danger Zone
            </h2>
            <p className="text-muted-foreground text-ui mb-6">
              Deleting this workspace will permanently remove all projects, channels, tasks, and messages associated with it. This action cannot be undone.
            </p>
            
            <div className="flex items-center justify-between p-4 bg-background border border-danger-border rounded-lg">
              <div>
                <h4 className="font-[590] text-foreground">Delete Workspace</h4>
                <p className="text-caption text-subtle-foreground">Permanently remove everything.</p>
              </div>
              <Button onClick={() => setDeleteModalOpen(true)} variant="destructive" className="px-4 py-2 bg-danger hover:bg-danger/90 text-danger-foreground text-ui font-[590] rounded-md transition-colors h-auto">
                Delete Workspace
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deleteModalOpen && (
          <Dialog open onOpenChange={(open) => { if (!open) setDeleteModalOpen(false); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-6 h-6" strokeWidth={1.5} />
                  Delete Workspace
                </DialogTitle>
                <DialogDescription>
                  This action is permanent. Please type <span className="font-mono font-[590] text-foreground bg-hover px-1 py-0.5 rounded">DEVSYNC</span> to confirm.
                </DialogDescription>
              </DialogHeader>
              <Input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DEVSYNC"
                aria-label="Type DEVSYNC to confirm deletion"
                className="focus:border-destructive focus:ring-destructive"
              />
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== 'DEVSYNC' || isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Forever'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </div>
  );
};
