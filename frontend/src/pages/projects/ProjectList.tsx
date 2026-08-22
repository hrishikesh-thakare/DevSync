
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { FolderKanban, Plus, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

export const ProjectList = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { projects, isAdmin } = useCurrentWorkspaceStore();

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-background text-foreground">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h1 font-[590] text-foreground mb-1">Projects</h1>
          <p className="text-ui text-muted-foreground">View and manage all active projects in this workspace.</p>
        </div>
        {isAdmin() && (
          <Button
            onClick={() => navigate(`/w/${slug}/projects/new`)}
            className="flex items-center px-4 py-2 font-[590] rounded-md transition-colors shadow-sm"
            variant="primary" size="default"
          >
            <Plus className="w-4 h-4 mr-2" strokeWidth={1.75} />
            Create Project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border border-dashed rounded-lg">
          <FolderKanban className="w-12 h-12 text-subtle-foreground/40 mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="text-h3 font-[510] text-foreground">No projects yet</h3>
          <p className="text-subtle-foreground mt-1">Create your first project to start tracking tasks and sprints.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <Button
              key={proj.projectId}
              onClick={() => navigate(`/w/${slug}/projects/${proj.key}`)}
              className="group relative flex flex-col text-left bg-card hover:bg-hover border border-border hover:border-border-strong rounded-lg p-6 transition-colors duration-[--duration-slow] hover:shadow-md overflow-hidden"
              variant="ghost" size="default"
            >
              {/* Corner wash on hover. Flat primary tint rather than the old
                  gradient-to-transparent — §5 allows no decorative gradients. */}
              <div
                className="absolute top-0 right-0 w-24 h-24 bg-primary-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 rounded-bl-full transition-opacity duration-[--duration-slow]"
                aria-hidden="true"
              />

              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-primary-muted border border-primary-border flex items-center justify-center group- transition-colors duration-[--duration-slow]">
                  <FolderKanban className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <span className="text-caption font-mono font-[590] bg-muted px-2 py-1 border border-border rounded text-muted-foreground">
                  {proj.key}
                </span>
              </div>

              <h3 className="text-h3 font-[590] text-foreground group-hover:text-primary transition-colors">
                {proj.name}
              </h3>
              <p className="text-ui text-subtle-foreground mt-2 mb-6 line-clamp-2">
                Manage tasks, sprints, and CI/CD pipelines for {proj.name}.
              </p>

              <div className="mt-auto flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-hover border border-background"></div>
                  <div className="w-6 h-6 rounded-full bg-hover border border-background"></div>
                  <div className="w-6 h-6 rounded-full bg-hover border border-background flex items-center justify-center text-micro">...</div>
                </div>
                <div className="flex items-center space-x-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={(e) => { e.stopPropagation(); navigate(`/w/${slug}/projects/${proj.key}/settings`); }} className="text-subtle-foreground hover:text-foreground p-1 rounded transition-colors" aria-label="Project Settings" size="icon" variant="ghost">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Project Settings</TooltipContent>
                  </Tooltip>
                  <div className="flex items-center text-ui font-[510] text-muted-foreground group-hover:text-primary transition-colors">
                    Open
                    <ChevronRight className="w-4 h-4 ml-1 group- transition-colors" strokeWidth={1.75} />
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
