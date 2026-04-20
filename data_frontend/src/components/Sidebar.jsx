import { NavLink } from 'react-router-dom';

export default function Sidebar({ isOpen, onClose }) {
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

        <div className="px-6 py-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-xl" data-icon="architecture" style={{ fontVariationSettings: "'FILL' 1" }}>architecture</span>
            </div>
            <div>
              <h1 className="font-['Manrope'] font-black uppercase tracking-tighter text-[#94aaff] text-lg leading-none">DataLens</h1>
              <span className="text-[10px] text-on-surface-variant tracking-widest uppercase opacity-70">Analytics Platform</span>
            </div>
          </div>
          <button className="w-full bg-primary hover:bg-primary-fixed-dim text-on-primary-container font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 mb-8 transition-all active:scale-95 duration-100">
            <span className="material-symbols-outlined text-sm" data-icon="upload">upload</span>
            Upload Data
          </button>
          <nav className="flex flex-col space-y-2">
            <NavLink to="/dashboard" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}>
              <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
              Dashboard
            </NavLink>
            <NavLink to="/data-explorer" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}>
              <span className="material-symbols-outlined" data-icon="table_chart">table_chart</span>
              Data Explorer
            </NavLink>
            <NavLink to="/visualizer" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}>
              <span className="material-symbols-outlined" data-icon="insights">insights</span>
              Visualizer
            </NavLink>
            <NavLink to="/reports" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}>
              <span className="material-symbols-outlined" data-icon="description">description</span>
              Reports
            </NavLink>
            <NavLink to="/ai-insights" onClick={handleNavClick}
              className={({ isActive }) => (isActive ? activeLinkClasses : inactiveLinkClasses)}>
              <span className="material-symbols-outlined" data-icon="auto_awesome">auto_awesome</span>
              AI Insights
            </NavLink>
          </nav>
        </div>
        <div className="mt-auto p-6 space-y-2">
          <a href="#" className="flex items-center gap-3 text-gray-500 px-4 py-3 mx-0 hover:text-gray-300 hover:bg-[#20201f] rounded-lg transition-all">
            <span className="material-symbols-outlined" data-icon="help_outline">help_outline</span>
            Support
          </a>
          <a href="#" className="flex items-center gap-3 text-error-dim px-4 py-3 mx-0 hover:bg-error-container/10 rounded-lg transition-all">
            <span className="material-symbols-outlined" data-icon="logout">logout</span>
            Sign Out
          </a>
        </div>
      </aside>
    </>
  );
}
