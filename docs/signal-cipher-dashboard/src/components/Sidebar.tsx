import { 
  BarChart3, 
  MessageSquare, 
  AlertCircle, 
  Clock, 
  FileText, 
  Settings, 
  Users, 
  HelpCircle, 
  User,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-react';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  toggle: () => void;
}

export function Sidebar({ isOpen, toggle }: SidebarProps) {
  const navItems = [
    { icon: Activity, label: 'Overview', active: true },
    { icon: BarChart3, label: 'Projects' },
    { icon: MessageSquare, label: 'Channels' },
    { icon: AlertCircle, label: 'Issues' },
    { icon: Clock, label: 'Timeline' },
    { icon: FileText, label: 'Reports' },
  ];

  const bottomItems = [
    { icon: Settings, label: 'Settings' },
    { icon: Users, label: 'Team' },
  ];

  return (
    <aside 
      className={clsx(
        "flex flex-col border-r border-border-default bg-bg-elevated transition-all duration-300 z-20",
        isOpen ? "w-60" : "w-16"
      )}
    >
      <div className="flex items-center h-16 px-4 border-b border-border-subtle justify-between shrink-0">
        <div className={clsx("flex items-center gap-3 overflow-hidden", !isOpen && "w-0 opacity-0")}>
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-bg-base" />
          </div>
          <span className="font-display font-bold text-lg whitespace-nowrap">Signal Cipher</span>
        </div>
        <button 
          onClick={toggle}
          className="p-1.5 rounded-md hover:bg-bg-surface text-text-secondary hover:text-text-primary transition-colors shrink-0"
        >
          {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item, i) => (
          <NavItem key={i} icon={item.icon} label={item.label} active={item.active} isOpen={isOpen} />
        ))}
        
        <div className="my-4 border-t border-border-subtle mx-2" />
        
        {bottomItems.map((item, i) => (
          <NavItem key={i} icon={item.icon} label={item.label} isOpen={isOpen} />
        ))}
      </div>

      <div className="p-2 border-t border-border-subtle flex flex-col gap-1 shrink-0">
        <NavItem icon={HelpCircle} label="Help" isOpen={isOpen} />
        <NavItem icon={User} label="Profile" isOpen={isOpen} />
      </div>
    </aside>
  );
}

function NavItem({ icon: Icon, label, active, isOpen }: { key?: string | number, icon: any, label: string, active?: boolean, isOpen: boolean }) {
  return (
    <button
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left group",
        active 
          ? "bg-accent/10 text-accent" 
          : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
      )}
      title={!isOpen ? label : undefined}
    >
      <Icon className={clsx("w-5 h-5 shrink-0", active ? "text-accent" : "text-text-secondary group-hover:text-text-primary")} />
      <span className={clsx(
        "font-medium text-[13px] whitespace-nowrap transition-all duration-300",
        !isOpen && "opacity-0 translate-x-4 w-0 hidden"
      )}>
        {label}
      </span>
    </button>
  );
}
