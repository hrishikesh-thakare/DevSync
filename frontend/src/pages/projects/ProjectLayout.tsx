import { useEffect, useState } from 'react';
import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom';
import { Kanban, List, Settings, Filter, IterationCcw, Users, GitBranch, Hash } from 'lucide-react';
import clsx from 'clsx';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { useAuthStore } from '../../store/auth.js';
import { apiFetch } from '../../lib/api.js';
import type { ProjectMember } from '../../store/boardStore.js';
import { Button } from '@/components/ui/button';

export const ProjectLayout = () => {
  const { slug, key } = useParams();
  const { projects, isAdmin } = useCurrentWorkspaceStore();
  const currentUser = useAuthStore(state => state.user);
  const navigate = useNavigate();
  
  const [isProjectAdmin, setIsProjectAdmin] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const data = await apiFetch(`/workspaces/${slug}/projects/${key}/members`);
        const members = data.members || [];
        const myMembership = members.find((m: ProjectMember) => m.userId === currentUser?.userId);
        setIsProjectAdmin(myMembership?.role === 'project_admin');
      } catch (err) {
        console.error('Failed to fetch project members for layout', err);
      }
    };
    if (slug && key) fetchRole();
  }, [slug, key, currentUser?.userId]);
  
  // Find current project details from the sidebar store
  const currentProject = projects.find(p => p.key === key?.toUpperCase());

  // Handle invalid project keys
  useEffect(() => {
    if (!currentProject) {
      navigate(`/w/${slug}/projects`, { replace: true });
    }
  }, [currentProject, navigate, slug]);

  if (!currentProject) return null;

  const tabClass = ({ isActive }: { isActive: boolean }) => clsx(
    "flex items-center pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
    isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border-strong"
  );

  return (
    <div className="flex h-full flex-col font-sans bg-background">
      {/* Project Header Area */}
      <div className="border-b border-border bg-background px-6 pt-6 pb-0 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-muted border border-primary-border rounded-lg flex items-center justify-center">
              <Kanban className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xs font-semibold text-subtle-foreground uppercase tracking-widest mb-0.5">Project / {key}</div>
              <h2 className="text-xl font-bold text-foreground">{currentProject?.name || 'Loading Project...'}</h2>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex -space-x-2 mr-2">
              <div className="w-8 h-8 rounded-full bg-secondary border-2 border-background z-20"></div>
              <div className="w-8 h-8 rounded-full bg-secondary border-2 border-background z-10"></div>
              <div className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs text-foreground z-0">+3</div>
            </div>
            <Button className="p-2 text-muted-foreground hover:text-foreground hover:bg-hover rounded-lg transition-colors" size="icon" variant="ghost">
              <Filter className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation — All 7 tabs */}
        <div className="flex space-x-6 mt-2 overflow-x-auto">
          <NavLink to={`/w/${slug}/projects/${key}`} end className={tabClass}>
            <Kanban className="w-4 h-4 mr-2" />
            Board
          </NavLink>
          <NavLink to={`/w/${slug}/projects/${key}/backlog`} className={tabClass}>
            <List className="w-4 h-4 mr-2" />
            Backlog
          </NavLink>
          <NavLink to={`/w/${slug}/projects/${key}/sprints`} className={tabClass}>
            <IterationCcw className="w-4 h-4 mr-2" />
            Sprints
          </NavLink>
          <NavLink to={`/w/${slug}/projects/${key}/channels`} className={tabClass}>
            <Hash className="w-4 h-4 mr-2" />
            Channels
          </NavLink>
          <NavLink to={`/w/${slug}/projects/${key}/github`} className={tabClass}>
            <GitBranch className="w-4 h-4 mr-2" />
            GitHub
          </NavLink>
          <NavLink to={`/w/${slug}/projects/${key}/members`} className={tabClass}>
            <Users className="w-4 h-4 mr-2" />
            Members
          </NavLink>
          {/* Settings tab — visible to project_admin or workspace admin */}
          {(isAdmin() || isProjectAdmin) && (
            <NavLink to={`/w/${slug}/projects/${key}/settings`} className={tabClass}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </NavLink>
          )}
        </div>
      </div>

      {/* Main Board/Backlog Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-background relative">
        <Outlet />
      </div>
    </div>
  );
};
