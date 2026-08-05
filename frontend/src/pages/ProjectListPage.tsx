import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentWorkspaceStore } from '../store/currentWorkspace';
import { useProjectStore } from '../store/useProjectStore';
import { 
  FolderGit2, 
  Plus, 
  Search, 
  Layout, 
  Calendar, 
  MoreVertical,
  Loader2,
  X
} from 'lucide-react';

const ProjectListPage: React.FC = () => {
  const { name: workspaceName, isAdmin } = useCurrentWorkspaceStore();
  const { projects, isLoading, fetchProjects, createProject } = useProjectStore();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create Modal State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectKey, setNewProjectKey] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Auto-generate key when name changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewProjectName(name);
    // Generate key: First 3 alphanumeric chars, uppercase
    const generatedKey = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
    setNewProjectKey(generatedKey);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectKey.trim()) return;

    setIsCreating(true);
    try {
      await createProject({
        name: newProjectName,
        projectKey: newProjectKey, // In a real app we might pass this directly if the store accepts it
        description: newProjectDescription
      });
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectKey('');
      setNewProjectDescription('');
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canCreate = isAdmin();

  return (
    <div className="p-8 h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Projects</h1>
          <p className="text-text-secondary text-sm">All active projects in {workspaceName}</p>
        </div>
        
        {canCreate && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="gradient-btn px-4 py-2 flex items-center gap-2"
          >
            <Plus size={18} />
            <span>Create Project</span>
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <input 
            type="text" 
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-tertiary/50 border border-border-default rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-accent-purple/50 transition-colors"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-auto pb-8">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-accent-purple" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
              <FolderGit2 className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-bold mb-2">No projects found</h3>
            <p className="text-sm text-text-secondary mb-6">Get started by creating a new project to manage tasks and sprints.</p>
            {canCreate && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="gradient-btn px-6 py-2.5 flex items-center gap-2"
              >
                <Plus size={18} />
                <span>Create First Project</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div 
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="glass-card p-6 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-accent-purple/5 transition-all group flex flex-col border border-border-default hover:border-accent-purple/30"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-bg-tertiary to-bg-secondary border border-border-light flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                    <FolderGit2 className="w-6 h-6 text-accent-purple" />
                  </div>
                  <button className="text-text-muted hover:text-white p-1" onClick={(e) => { e.stopPropagation(); /* TODO: project menu */ }}>
                    <MoreVertical size={18} />
                  </button>
                </div>
                
                <h3 className="text-lg font-bold text-text-primary group-hover:text-accent-purple transition-colors mb-1 line-clamp-1">
                  {project.name}
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-1.5 py-0.5 rounded bg-bg-tertiary border border-border-light text-[10px] font-bold text-text-secondary font-mono">
                    {project.id}
                  </span>
                  <span className="text-xs text-text-muted">·</span>
                  <span className="flex items-center gap-1 text-xs text-text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                    Active
                  </span>
                </div>
                
                <p className="text-sm text-text-secondary line-clamp-2 mb-6 flex-1">
                  {project.description || 'No description provided.'}
                </p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border-default/50">
                  <div className="flex items-center gap-4 text-xs font-medium text-text-muted">
                    <div className="flex items-center gap-1.5">
                      <Layout size={14} />
                      <span>Board</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>Sprints</span>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-bg-tertiary border border-bg-primary shadow-sm" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card-strong max-w-lg w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <FolderGit2 className="text-accent-purple" size={24} />
              Create Project
            </h2>
            <p className="text-sm text-text-secondary mb-6">Set up a new project to start organizing tasks and sprints.</p>

            <form onSubmit={handleCreateProject} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                  Project Name
                </label>
                <input 
                  type="text" 
                  value={newProjectName}
                  onChange={handleNameChange}
                  className="w-full bg-bg-tertiary border border-border-default rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent-purple/50 transition-colors"
                  placeholder="e.g. Website Redesign"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Project Key</span>
                  <span className="text-[10px] font-normal text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">Cannot be changed later</span>
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    value={newProjectKey}
                    onChange={(e) => setNewProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className="w-24 bg-bg-tertiary border border-border-default rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-accent-purple/50 transition-colors"
                    placeholder="WEB"
                    maxLength={5}
                    required
                  />
                  <p className="text-xs text-text-muted flex-1">
                    Used as the prefix for all tasks (e.g. <b>{newProjectKey || 'WEB'}-101</b>). Max 5 characters.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea 
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="w-full bg-bg-tertiary border border-border-default rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent-purple/50 transition-colors resize-none h-24"
                  placeholder="Briefly describe the goals of this project..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border-default/50">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-border-default hover:bg-bg-hover transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!newProjectName.trim() || !newProjectKey.trim() || isCreating}
                  className="flex-1 gradient-btn px-4 py-2.5 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectListPage;
