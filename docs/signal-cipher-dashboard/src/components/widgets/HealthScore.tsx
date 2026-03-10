import { ArrowUpRight, Activity } from 'lucide-react';

export function HealthScore() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-default bg-bg-elevated p-6 shadow-sm group">
      {/* Background glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-accent/10 to-transparent opacity-50 blur-2xl group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-text-secondary">
            <Activity className="w-5 h-5 text-accent" />
            <h2 className="font-display font-semibold text-lg">Player Health Score</h2>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="font-display font-bold text-6xl text-text-primary tracking-tight">7.2</span>
            <span className="font-display font-medium text-2xl text-text-muted">/10</span>
            <div className="flex items-center gap-1 text-positive bg-positive/10 px-2.5 py-1 rounded-full text-sm font-medium ml-2">
              <ArrowUpRight className="w-4 h-4" />
              0.3
            </div>
          </div>
          <p className="text-sm text-text-muted font-medium mt-1">
            Based on 2,847 signals across 5 channels, last 7 days
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-auto min-w-[240px]">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-positive">Positive 56%</span>
            <span className="text-negative">Negative 28%</span>
            <span className="text-text-muted">Neutral 16%</span>
          </div>
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-bg-surface border border-border-subtle">
            <div className="h-full bg-positive transition-all duration-1000 ease-out" style={{ width: '56%' }} />
            <div className="h-full bg-negative transition-all duration-1000 ease-out" style={{ width: '28%' }} />
            <div className="h-full bg-border-default transition-all duration-1000 ease-out" style={{ width: '16%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
