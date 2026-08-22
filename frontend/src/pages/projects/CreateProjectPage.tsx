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
            <FolderKanban className="w-8 h-8 text-primary" strokeWidth={1.5} />
          </div>
        </div>
        
        <h1 className="text-h1 font-[590] text-center text-foreground mb-2">Create a New Project</h1>
        <p className="text-center text-muted-foreground mb-8 text-ui">Start tracking tasks, sprints, and CI/CD pipelines.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="createprojectpage-project-name" className="block text-ui font-[510] text-foreground mb-1.5">Project Name</Label>
            <Input 
              id="createprojectpage-project-name"
              type="text" 
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!key) setKey(e.target.value.substring(0, 3).toUpperCase());
              }}
              placeholder="e.g. Mobile App V2"
              className="w-full bg-background px-4 py-3 text-foreground"
            />
          </div>

          <div>
            <Label htmlFor="createprojectpage-project-key" className="block text-ui font-[510] text-foreground mb-1.5">Project Key</Label>
            <Input 
              id="createprojectpage-project-key"
              type="text" 
              required
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. MOB"
              className="w-full bg-background px-4 py-3 text-foreground font-mono uppercase"
            />
            <p className="text-caption text-subtle-foreground mt-1.5">Used as a prefix for task IDs (e.g. MOB-1). Immutable after creation.</p>
          </div>

          <div>
            <Label htmlFor="createprojectpage-description-optional" className="block text-ui font-[510] text-foreground mb-1.5">Description (Optional)</Label>
            <Textarea 
              id="createprojectpage-description-optional"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="w-full bg-background px-4 py-3 text-foreground"
            />
          </div>

          <div className="pt-4 flex items-center justify-end space-x-4">
            <Button 
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 text-muted-foreground hover:text-foreground transition-colors text-ui font-[510]"
              variant="ghost" size="default"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isLoading || !name || !key}
              className="flex items-center px-6 py-2.5 bg-primary hover:bg-primary-hover disabled:text-disabled text-primary-foreground"
              variant="primary" size="default"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.75} /> : 'Create Project'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
