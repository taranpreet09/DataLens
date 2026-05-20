import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const { logout } = useAuth();
  const commonLinkClasses = "flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all duration-200";
  const activeLinkClasses = `bg-[#20201f] text-[#94aaff] ${commonLinkClasses} translate-x-1`;
  const inactiveLinkClasses = `text-gray-500 hover:text-gray-300 hover:bg-[#20201f] hover:translate-x-1 ${commonLinkClasses}`;

  const handleNavClick = () => { if (onClose) onClose(); };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose}></div>
      )}

      <aside className={`h-screen w-64 fixed left-0 top-0 flex flex-col bg-[#131313] dark:bg-[#131313] font-['Inter'] text-sm font-medium z-50 overflow-hidden transition-transform duration-300 lg:translate-x-0 print:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Mobile close button */}
        <button onClick={onClose} className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#20201f] text-gray-400 transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="px-6 py-6 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
            </div>
            <div>
              <h1 className="font-['Manrope'] font-black uppercase tracking-tighter text-[#94aaff] text-lg leading-none">Obsidian Analytics</h1>
              <span className="text-[10px] text-on-surface-variant tracking-widest uppercase opacity-70">Analytics Platform</span>
            </div>
          </div>
          <nav className="flex flex-col space-y-2">
            <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-bold">
              Library
            </div>
            <NavLink to="/dashboard" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}>
              <span className="material-symbols-outlined">folder</span>
              Datasets
            </NavLink>

            <div className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-bold">
              Work
            </div>
            <NavLink to="/workspace" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}
              end={false}>
              <span className="material-symbols-outlined">workspaces</span>
              Workspace
            </NavLink>
            <NavLink to="/ai-insights" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}>
              <span className="material-symbols-outlined">auto_awesome</span>
              AI Insights
            </NavLink>
            <NavLink to="/reports" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}>
              <span className="material-symbols-outlined">description</span>
              Reports
            </NavLink>
            <NavLink to="/compare" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}>
              <span className="material-symbols-outlined">compare_arrows</span>
              Compare
            </NavLink>
          </nav>
        </div>
        <div className="p-6 space-y-2 border-t border-[#20201f]">
          <a href="#" className="flex items-center gap-3 text-gray-500 px-4 py-3 mx-0 hover:text-gray-300 hover:bg-[#20201f] rounded-lg transition-all">
            <span className="material-symbols-outlined">help_outline</span>
            Support
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} className="flex items-center gap-3 text-error-dim px-4 py-3 mx-0 hover:bg-error-container/10 rounded-lg transition-all">
            <span className="material-symbols-outlined">logout</span>
            Sign Out
          </a>
        </div>
      </aside>
    </>
  );
}
