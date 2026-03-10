import { ServerCrash, X } from 'lucide-react';
import { useState } from 'react';

export function AlertBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-negative/50 bg-negative/10 p-4 shadow-sm flex items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 fade-in duration-500">
      <div className="absolute inset-0 bg-gradient-to-r from-negative/20 to-transparent pointer-events-none" />
      
      <div className="flex items-start sm:items-center gap-3 relative z-10">
        <div className="p-2 bg-negative/20 rounded-lg shrink-0">
          <ServerCrash className="w-5 h-5 text-negative animate-pulse" />
        </div>
        <div className="flex flex-col">
          <h4 className="font-display font-semibold text-text-primary">Infrastructure Correlation Detected</h4>
          <p className="text-sm text-text-secondary">
            Server <span className="font-mono text-negative">eu-east-1</span> unreachable from Russia. 28 complaints in Telegram, 3 new ★1 reviews.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 relative z-10">
        <button className="text-sm font-semibold bg-negative text-bg-base px-4 py-2 rounded-lg hover:bg-negative/90 transition-colors">
          View Details
        </button>
        <button 
          onClick={() => setIsVisible(false)}
          className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-surface rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
