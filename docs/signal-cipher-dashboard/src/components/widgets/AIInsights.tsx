import { Sparkles, ChevronRight, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { clsx } from 'clsx';

const insights = [
  {
    id: '1',
    text: 'Crash reports spiked 3x after v2.4.1 release. 80% come from Samsung Galaxy S24 users. No ticket exists in TeamWork.',
    confidence: 5,
    action: 'Create Ticket',
    type: 'critical'
  },
  {
    id: '2',
    text: 'Players are praising the new Battle Pass progression speed on Telegram, but App Store reviews still complain about it being too slow.',
    confidence: 4,
    action: 'View Details',
    type: 'info'
  }
];

export function AIInsights() {
  return (
    <div className="flex flex-col gap-4 bg-bg-elevated rounded-2xl border border-border-default p-6 shadow-sm h-full ai-border relative overflow-hidden">
      {/* Subtle AI background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-ai-start/5 to-ai-end/5 pointer-events-none" />
      
      <div className="flex items-center justify-between relative z-10">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2 ai-text">
          <Sparkles className="w-5 h-5 text-ai-start" />
          AI Insights
        </h3>
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Next Best Action</span>
      </div>

      <div className="flex flex-col gap-4 mt-2 relative z-10">
        {insights.map((insight) => (
          <div 
            key={insight.id}
            className="flex flex-col gap-3 p-4 rounded-xl border border-border-subtle bg-bg-surface/50 backdrop-blur-sm hover:bg-bg-surface transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {insight.type === 'critical' ? (
                  <AlertTriangle className="w-4 h-4 text-negative" />
                ) : (
                  <Info className="w-4 h-4 text-accent" />
                )}
              </div>
              <p className="text-sm text-text-primary leading-relaxed">
                {insight.text}
              </p>
            </div>
            
            <div className="flex items-center justify-between mt-2 pl-7">
              <div className="flex items-center gap-1" title={`Confidence: ${insight.confidence}/5`}>
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i} 
                    className={clsx(
                      "w-1.5 h-1.5 rounded-full",
                      i < insight.confidence ? "bg-ai-start" : "bg-border-default"
                    )}
                  />
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <button className="text-xs font-semibold text-text-muted hover:text-text-primary transition-colors px-2 py-1">
                  Dismiss
                </button>
                <button className={clsx(
                  "flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors",
                  insight.action === 'Create Ticket' 
                    ? "bg-accent text-bg-base hover:bg-accent-hover" 
                    : "bg-bg-elevated border border-border-default text-text-primary hover:border-accent"
                )}>
                  {insight.action}
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
