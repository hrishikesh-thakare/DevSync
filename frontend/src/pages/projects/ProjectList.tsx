
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentWorkspaceStore } from '../../store/currentWorkspace.js';
import { FolderKanban, Plus, ChevronRight } from 'lucide-react';

export const ProjectList = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { projects, isAdmin } = useCurrentWorkspaceStore();

  return (
    <div className="h-full overflow-y-auto p-8 font-sans bg-gray-950 text-gray-200">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Projects</h1>
          <p className="text-sm text-gray-400">View and manage all active projects in this workspace.</p>
        </div>
        {isAdmin() && (
          <button 
            onClick={() => navigate(`/w/${slug}/projects/new`)}
            className="flex items-center px-4 py-2 bg-gray-400 hover:bg-white text-white font-bold rounded-lg transition-colors shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-gray-900/40 border border-gray-800 border-dashed rounded-2xl">
          <FolderKanban className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300">No projects yet</h3>
          <p className="text-gray-500 mt-1">Create your first project to start tracking tasks and sprints.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => (
            <button
              key={proj.projectId}
              onClick={() => navigate(`/w/${slug}/projects/${proj.key}`)}
              className="group relative flex flex-col text-left bg-gray-900/40 hover:bg-gray-800/60 border border-gray-800/60 hover:border-white/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-white/10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 rounded-bl-full transition-opacity duration-500" />
              
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FolderKanban className="w-6 h-6 text-gray-300" />
                </div>
                <span className="text-xs font-mono font-semibold bg-gray-950 px-2 py-1 border border-gray-800 rounded text-gray-400">
                  {proj.key}
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-100 group-hover:text-gray-300 transition-colors">
                {proj.name}
              </h3>
              <p className="text-sm text-gray-500 mt-2 mb-6 line-clamp-2">
                Manage tasks, sprints, and CI/CD pipelines for {proj.name}.
              </p>

              <div className="mt-auto flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-white border border-gray-900"></div>
                  <div className="w-6 h-6 rounded-full bg-white border border-gray-900"></div>
                  <div className="w-6 h-6 rounded-full bg-gray-800 border border-gray-900 flex items-center justify-center text-[8px]">...</div>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/w/${slug}/projects/${proj.key}/settings`); }} className="text-gray-500 hover:text-white p-1 rounded transition-colors" title="Project Settings">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <div className="flex items-center text-sm font-medium text-gray-400 group-hover:text-white transition-colors">
                    Open
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
