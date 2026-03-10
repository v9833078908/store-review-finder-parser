import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Smartphone, MessageSquare, Monitor, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const data = [
  { name: 'Google Play', value: 1240, color: '#22C55E', icon: Smartphone, trend: 'up', delta: '12%' },
  { name: 'Telegram', value: 850, color: '#06B6D4', icon: MessageSquare, trend: 'up', delta: '5%' },
  { name: 'App Store', value: 430, color: '#A1A1AA', icon: Smartphone, trend: 'down', delta: '2%' },
  { name: 'Discord', value: 327, color: '#6366F1', icon: Monitor, trend: 'up', delta: '8%' },
];

export function ChannelMix() {
  return (
    <div className="flex flex-col gap-4 bg-bg-elevated rounded-2xl border border-border-default p-6 shadow-sm h-full">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-lg">Channel Mix</h3>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-6 mt-2">
        {/* Custom Horizontal Stacked Bar instead of generic pie */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm font-medium mb-1">
            <span className="text-text-primary">Total Signals</span>
            <span className="text-text-muted font-mono">2,847</span>
          </div>
          <div className="h-4 w-full rounded-full overflow-hidden flex bg-bg-surface border border-border-subtle">
            {data.map((entry, index) => (
              <div 
                key={index} 
                className="h-full transition-all duration-1000 ease-out hover:opacity-80 cursor-pointer" 
                style={{ width: `${(entry.value / 2847) * 100}%`, backgroundColor: entry.color }}
                title={`${entry.name}: ${entry.value}`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {data.map((item) => (
            <div key={item.name} className="flex flex-col gap-2 p-3 rounded-xl bg-bg-surface border border-border-subtle hover:border-border-default transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{item.name}</span>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <span className="font-mono font-bold text-lg text-text-primary">{item.value.toLocaleString()}</span>
                <div className={`flex items-center gap-0.5 text-[11px] font-medium ${item.trend === 'up' ? 'text-positive' : 'text-negative'}`}>
                  {item.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {item.delta}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
