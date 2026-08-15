import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  MessageSquare, 
  Search, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Plus
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useProjectStore } from '../../store/useProjectStore';
import { useAuthStore } from '../../store/useAuthStore';

const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { projects } = useProjectStore();
  const { user } = useAuthStore();

  const firstProjectId = projects.length > 0 ? projects[0].id : '';

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Layers size={20} />, label: 'Projects', path: firstProjectId ? `/projects/${firstProjectId}` : '/projects' },
    { icon: <MessageSquare size={20} />, label: 'Chat', path: '/chat' },
    { icon: <Search size={20} />, label: 'Search', path: '/search' },
  ];

  return (
    <aside 
      className={`glass-sidebar h-full transition-all duration-300 flex flex-col ${isCollapsed ? 'w-20' : 'w-64'}`}
    >
      <div className="p-6 flex items-center justify-between">
        {!isCollapsed && <span className="text-xl font-bold gradient-text">DevSync</span>}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-bg-hover rounded-lg transition-colors text-text-secondary"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center gap-3 p-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-white/10 text-white border border-white/20' 
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`
            }
          >
            {item.icon}
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
          </NavLink>
        ))}

        {!isCollapsed && (
          <div className="mt-8 pt-6 border-t border-border-default">
            <div className="flex items-center justify-between px-2 mb-4">
              <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Recent Projects</span>
              <button className="text-text-secondary hover:text-white">
                <Plus size={14} />
              </button>
            </div>
            {projects.slice(0, 5).map((proj) => (
              <NavLink
                key={proj.id}
                to={`/projects/${proj.id}`}
                className={({ isActive }) => 
                  `flex items-center gap-3 p-2 rounded-lg transition-all text-sm ${
                    isActive ? 'bg-white/5 text-white' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`
                }
              >
                <div className={`w-2 h-2 rounded-full ${proj.status === 'active' ? 'bg-white' : 'bg-white'}`}></div>
                <span className="truncate">{proj.name}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="p-4 mt-auto border-t border-border-default">
        <NavLink
            to="/settings"
            className="flex items-center gap-3 p-3 text-text-secondary hover:text-text-primary transition-all"
        >
          <Settings size={20} />
          {!isCollapsed && <span className="font-medium text-sm">Settings</span>}
        </NavLink>
        <div className="flex items-center gap-3 p-3 mt-2 rounded-2xl bg-bg-tertiary/50 border border-border-default">
          {user?.avatarUrl ? (
             <img src={user.avatarUrl || undefined} alt={user.fullName} className="w-8 h-8 rounded-full border border-white/30" />
          ) : (
             <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-xs font-bold">
               {user?.fullName?.charAt(0) || 'U'}
             </div>
          )}
          
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.fullName || 'User'}</p>
              <p className="text-xs text-text-muted truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
