import { Search, Bell, ChevronDown, Filter } from 'lucide-react';

export function Topbar() {
  return (
    <header className="h-16 border-b border-border-default bg-bg-elevated/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-1.5 cursor-pointer hover:border-border-default transition-colors">
          <span className="text-sm font-medium">Project: <span className="text-text-primary">Cyberpunk 2077</span></span>
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        </div>
        
        <div className="h-6 w-px bg-border-subtle" />
        
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-1.5 cursor-pointer hover:border-border-default transition-colors">
          <span className="text-sm font-medium">Date: <span className="text-text-primary">Last 7 Days</span></span>
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        </div>
        
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-1.5 cursor-pointer hover:border-border-default transition-colors">
          <Filter className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium">Channels: <span className="text-text-primary">All (7)</span></span>
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-text-secondary group-focus-within:text-accent transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="Search issues, players, AI..." 
            className="bg-bg-surface border border-border-subtle rounded-lg pl-9 pr-12 py-1.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent w-64 transition-all placeholder:text-text-muted"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-block border border-border-subtle rounded px-1.5 text-[10px] font-mono text-text-muted bg-bg-base">⌘K</kbd>
          </div>
        </div>
        
        <button className="relative p-2 rounded-full hover:bg-bg-surface transition-colors text-text-secondary hover:text-text-primary">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-negative rounded-full border border-bg-elevated"></span>
        </button>
      </div>
    </header>
  );
}
