
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { Hash, FolderKanban, ArrowRight, Users, Shield } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import type { VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';

export const WorkspaceHome = () => {
  const { slug } = useParams();
  const { name, description, projects, channels, myRole, memberCount, isAdmin, isOwner } = useCurrentWorkspaceStore();

  const roleBadge = (role: string) => {
    const variants: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
      owner: 'success',
      admin: 'outline',
      member: 'outline',
    };
    return variants[role] || variants.member;
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-background font-sans">
      
      {/* Welcome Banner */}
      <div className="bg-card border border-border rounded-lg p-8 mb-8 relative overflow-hidden">
        {/* Corner tint. Was a blurred white glow; §5 forbids glows, so this is a
            flat primary wash on the same surface ramp. */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-muted rounded-full pointer-events-none" aria-hidden="true"></div>
        <div className="flex items-start justify-between relative z-10">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground mb-2">Welcome to {name}</h1>
            <p className="text-muted-foreground max-w-2xl mb-4">
              {description || "Here's what's happening in your workspace today. Jump back into your active projects or catch up on channel discussions."}
            </p>
            {/* Stats Row */}
            <div className="flex items-center space-x-6 text-sm">
              <Badge
                  variant={roleBadge(myRole)}
                  className={clsx(
                    "h-auto px-2.5 py-1 rounded-full border font-semibold uppercase tracking-wider",
                    myRole === 'admin' && 'bg-primary-muted text-primary border-primary-border'
                  )}
                >
                  <Shield className="w-3.5 h-3.5 mr-1.5" />
                  {myRole}
                </Badge>
              <span className="flex items-center text-muted-foreground">
                <Users className="w-4 h-4 mr-1.5" />
                {memberCount} members
              </span>
              <span className="flex items-center text-muted-foreground">
                <FolderKanban className="w-4 h-4 mr-1.5" />
                {projects.length} projects
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 relative z-10">
          <Button asChild variant="default" className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors h-auto">
            <Link to={`/w/${slug}/projects`} className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-sm font-semibold transition-colors">
              View All Projects
            </Link>
          </Button>
          <Button asChild variant="secondary" className="px-4 py-2 rounded-lg text-sm font-medium transition-colors h-auto">
            <Link to={`/w/${slug}/notifications`} className="px-4 py-2 bg-secondary hover:bg-hover text-foreground rounded-md text-sm font-medium transition-colors">
              View Notifications
            </Link>
          </Button>
          <Button asChild variant="secondary" className="px-4 py-2 rounded-lg text-sm font-medium transition-colors h-auto">
            <Link to={`/w/${slug}/members`} className="px-4 py-2 bg-secondary hover:bg-hover text-foreground rounded-md text-sm font-medium transition-colors">
              {isAdmin() ? 'Manage Members' : 'View Members'}
            </Link>
          </Button>
          {isOwner() && (
            <Button asChild variant="secondary" className="px-4 py-2 rounded-lg text-sm font-medium transition-colors h-auto">
              <Link to={`/w/${slug}/settings`} className="px-4 py-2 bg-secondary hover:bg-hover text-foreground rounded-md text-sm font-medium transition-colors">
                Workspace Settings
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Projects Section */}
        <Card className="[--card-spacing:--spacing(6)] bg-elevated/50 border border-border">
          <CardHeader className="flex items-center justify-between [.border-b]:pb-(--card-spacing)">
            <div className="flex items-center space-x-2 text-foreground font-bold">
              <FolderKanban className="w-5 h-5 text-primary" />
              <h3>Recent Projects</h3>
            </div>
            <Link to={`/w/${slug}/projects`} className="text-xs text-subtle-foreground hover:text-foreground transition-colors">View all →</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {projects.slice(0, 5).map(p => (
                <Link key={p.projectId} to={`/w/${slug}/projects/${p.key}`} className="group flex items-center justify-between p-3 bg-background border border-border hover:border-border-strong rounded-lg transition-colors">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono bg-secondary text-muted-foreground px-2 py-0.5 rounded">{p.key}</span>
                    <span className="font-medium text-foreground group-hover:text-primary">{p.name}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-subtle-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
              {projects.length === 0 && <p className="text-sm text-subtle-foreground italic">No projects yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Channels Section */}
        <Card className="[--card-spacing:--spacing(6)] bg-elevated/50 border border-border">
          <CardHeader className="flex items-center justify-between [.border-b]:pb-(--card-spacing)">
            <div className="flex items-center space-x-2 text-foreground font-bold">
              <Hash className="w-5 h-5 text-primary" />
              <h3>Channels</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {channels.slice(0, 5).map(c => (
                <Link key={c.channelId} to={`/w/${slug}/channels/${c.channelId}`} className="group flex items-center justify-between p-3 bg-background border border-border hover:border-border-strong rounded-lg transition-colors">
                  <span className="font-medium text-foreground group-hover:text-primary">#{c.name}</span>
                  <ArrowRight className="w-4 h-4 text-subtle-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
              {channels.length === 0 && <p className="text-sm text-subtle-foreground italic">No channels yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
