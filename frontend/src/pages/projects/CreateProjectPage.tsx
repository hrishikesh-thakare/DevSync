import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { FolderKanban, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const CreateProjectPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { createProject } = useCurrentWorkspaceStore();
  
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug || !name || !key) return;
    
    setIsLoading(true);
    try {
      await createProject(slug, name, key, description);
      navigate(`/w/${slug}/projects/${key}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-center items-center bg-background p-6 font-sans">
      <Card className="w-full max-w-lg [--card-spacing:--spacing(8)] rounded-lg shadow-md bg-card border border-border">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary-muted border border-primary-border rounded-lg flex items-center justify-center">
            <FolderKanban className="w-8 h-8 text-primary" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-foreground mb-2">Create a New Project</h1>
        <p className="text-center text-muted-foreground mb-8 text-sm">Start tracking tasks, sprints, and CI/CD pipelines.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="block text-sm font-medium text-foreground mb-1.5">Project Name</Label>
            <Input 
              type="text" 
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!key) setKey(e.target.value.substring(0, 3).toUpperCase());
              }}
              placeholder="e.g. Mobile App V2"
              className="w-full bg-background border border-border rounded-md px-4 py-3 text-foreground focus:border-ring focus:ring-1 focus:ring-ring h-auto"
            />
          </div>

          <div>
            <Label className="block text-sm font-medium text-foreground mb-1.5">Project Key</Label>
            <Input 
              type="text" 
              required
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. MOB"
              className="w-full bg-background border border-border rounded-md px-4 py-3 text-foreground font-mono focus:border-ring focus:ring-1 focus:ring-ring uppercase h-auto"
            />
            <p className="text-xs text-subtle-foreground mt-1.5">Used as a prefix for task IDs (e.g. MOB-1). Immutable after creation.</p>
          </div>

          <div>
            <Label className="block text-sm font-medium text-foreground mb-1.5">Description (Optional)</Label>
            <Textarea 
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="w-full bg-background border border-border rounded-md px-4 py-3 text-foreground focus:border-ring focus:ring-1 focus:ring-ring h-auto"
            />
          </div>

          <div className="pt-4 flex items-center justify-end space-x-4">
            <Button 
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
              variant="ghost" size="default"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isLoading || !name || !key}
              className="flex items-center px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm font-bold rounded-md transition-colors"
              variant="default" size="default"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Project'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
