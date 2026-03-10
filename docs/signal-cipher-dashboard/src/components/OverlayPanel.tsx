import { X, ExternalLink, MessageSquare, AlertTriangle, CheckCircle2, Sparkles, TrendingUp, Smartphone, Monitor } from 'lucide-react';
import { clsx } from 'clsx';
import { useEffect, useState } from 'react';

interface OverlayPanelProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string | null;
}

export function OverlayPanel({ isOpen, onClose, issueId }: OverlayPanelProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (isOpen) setIsMounted(true);
    else setTimeout(() => setIsMounted(false), 300);
  }, [isOpen]);

  if (!isMounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={clsx(
          "fixed inset-0 bg-bg-base/80 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div 
        className={clsx(
          "fixed inset-y-0 right-0 w-full max-w-[420px] bg-bg-elevated border-l border-border-default shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-negative animate-pulse" />
            <h2 className="font-display font-semibold text-lg text-text-primary">Issue Details</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-surface text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
          {/* Header Info */}
          <div className="flex flex-col gap-4">
            <h1 className="font-display font-bold text-2xl text-text-primary leading-tight">
              Crash on Samsung after v2.4.1
            </h1>
            
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-negative/10 text-negative border border-negative/20 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Critical
              </span>
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-bg-surface border border-border-subtle">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Sources</span>
                <div className="flex items-center gap-2 mt-1">
                  <Smartphone className="w-4 h-4 text-positive" title="Google Play" />
                  <span className="text-sm font-semibold">GP (34)</span>
                  <div className="w-px h-3 bg-border-default mx-1" />
                  <MessageSquare className="w-4 h-4 text-accent" title="Telegram" />
                  <span className="text-sm font-semibold">TG (87)</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-bg-surface border border-border-subtle">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Trend</span>
                <div className="flex items-center gap-2 mt-1">
                  <TrendingUp className="w-4 h-4 text-negative" />
                  <span className="text-sm font-semibold text-negative">+45% today</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="flex flex-col gap-3 relative ai-border p-5 rounded-xl bg-gradient-to-br from-ai-start/5 to-ai-end/5">
            <div className="flex items-center gap-2 ai-text">
              <Sparkles className="w-4 h-4 text-ai-start" />
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider">AI Analysis</h3>
            </div>
            <p className="text-sm text-text-primary leading-relaxed">
              Affects Samsung Galaxy S24 specifically. 90% of reports mention v2.4.1 update installed within the last 24 hours. The crash occurs immediately upon opening the new "Neon District" map.
            </p>
          </div>

          {/* TeamWork Integration */}
          <div className="flex flex-col gap-3 p-5 rounded-xl border border-border-default bg-bg-surface">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-text-secondary">TeamWork</h3>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-negative bg-negative/10 px-2 py-1 rounded-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-negative opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-negative"></span>
                </span>
                No ticket found
              </span>
            </div>
            <button className="w-full py-2.5 rounded-lg bg-accent text-bg-base font-semibold text-sm hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 mt-2">
              Create Ticket
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Player Quotes */}
          <div className="flex flex-col gap-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-text-secondary flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Player Quotes
            </h3>
            
            <div className="flex flex-col gap-3">
              <Quote 
                source="google-play" 
                text="Game crashes every time I try to open the new map. Samsung S24 Ultra." 
                author="Alex M." 
                time="2h ago" 
              />
              <Quote 
                source="telegram" 
                text="After update 2.4.1 I can't even load into a match, it just black screens and closes." 
                author="SniperKing99" 
                time="3h ago" 
              />
              <Quote 
                source="google-play" 
                text="Literally unplayable on S24 since the patch yesterday. Fix this!!" 
                author="Anonymous" 
                time="5h ago" 
              />
            </div>
            
            <button className="text-sm font-medium text-accent hover:text-accent-hover transition-colors text-center mt-2">
              View all 121 quotes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Quote({ source, text, author, time }: { source: string, text: string, author: string, time: string }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-border-subtle bg-bg-surface hover:border-border-default transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {source === 'google-play' ? <Smartphone className="w-3.5 h-3.5 text-positive" /> : <MessageSquare className="w-3.5 h-3.5 text-accent" />}
          <span className="text-xs font-semibold text-text-primary">{author}</span>
        </div>
        <span className="text-[10px] font-medium text-text-muted">{time}</span>
      </div>
      <p className="text-sm text-text-secondary italic leading-relaxed">"{text}"</p>
    </div>
  );
}
