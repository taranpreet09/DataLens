import { useAuth } from '../context/AuthContext';

export default function Topbar({ onMenuToggle }) {
  const { user } = useAuth();
  return (
    <header className="w-full h-14 lg:h-16 sticky top-0 z-40 bg-[#0e0e0e] dark:bg-[#0e0e0e] border-b border-[#262626]/50 flex justify-between items-center px-4 lg:px-8 font-['Manrope'] antialiased tracking-tight print:hidden">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Hamburger for mobile */}
        <button onClick={onMenuToggle} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-[#20201f] text-gray-400 transition-colors shrink-0">
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <div className="text-base lg:text-xl font-bold text-[#94aaff] tracking-widest uppercase truncate">Obsidian Analytics</div>
        </div>
      </div>
      <div className="flex items-center gap-2 lg:gap-4 shrink-0">
        <button className="p-2 text-gray-400 hover:bg-[#20201f] transition-colors relative rounded-full">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1 right-2 w-2 h-2 bg-secondary rounded-full"></span>
        </button>
        <button className="p-2 text-gray-400 hover:bg-[#20201f] transition-colors rounded-full hidden sm:block">
          <span className="material-symbols-outlined">settings</span>
        </button>
        <div className="flex items-center gap-3 pl-3 lg:pl-4 border-l border-outline-variant/20 ml-1 lg:ml-2">
          <div className="hidden sm:flex flex-col items-end mr-1">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider leading-none">Welcome</span>
            <span className="text-xs font-bold text-on-surface truncate max-w-[120px]">{user?.fullName || user?.email || 'User'}</span>
          </div>
          <img alt="User profile avatar" className="w-8 h-8 rounded-full border border-outline-variant/50 object-cover" src={user?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuCLNdPX7wHTlj_a_BQdycdUUhOUGfsYy1blkSJuTHnmkuscKMCPoPK2OQ-PgIqTPo2CH9uPws22XN6nbbtxZbYR76I7RxQFK0DythBc84ny7BPmF_ZATd7uv0IQusKQqZuNWtsbyExudf3NgzlpaH8_zW2vYJp2xyTtm8IV42aZZLheYcTz0P2NZmVnuQfANXzhnStAkRIO34zJxV61CLvMvIboMNuiGPIGdhRLc5a0igbgFRiyoytNlVbLJE1sD73v09CGupybGhw"} />
        </div>
      </div>
    </header>
  );
}
