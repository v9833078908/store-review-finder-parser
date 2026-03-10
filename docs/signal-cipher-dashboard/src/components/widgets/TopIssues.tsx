import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, XCircle, MessageSquare, Smartphone, Monitor } from 'lucide-react';
import { clsx } from 'clsx';

interface TopIssuesProps {
  onSelectIssue: (id: string) => void;
}

const issues = [
  {
    id: '1',
    title: 'Crash on Samsung after v2.4.1',
    severity: 'critical',
    sources: ['google-play', 'telegram'],
    mentions: 121,
    trend: 'up',
    ticketStatus: 'open',
    type: 'confirmed'
  },
  {
    id: '2',
    title: 'PvP Balance - Sniper Rifle OP',
    severity: 'high',
    sources: ['discord', 'telegram'],
    mentions: 84,
    trend: 'up',
    ticketStatus: 'not-found',
    type: 'chat-blind-spot'
  },
  {
    id: '3',
    title: 'Login Error Code 403',
    severity: 'medium',
    sources: ['apple', 'google-play'],
    mentions: 45,
    trend: 'down',
    ticketStatus: 'in-progress',
    type: 'store-blind-spot'
  },
  {
    id: '4',
    title: 'Missing Battle Pass Rewards',
    severity: 'high',
    sources: ['google-play', 'apple', 'discord'],
    mentions: 32,
    trend: 'up',
    ticketStatus: 'resolved',
    type: 'sentiment-gap'
  }
];

export function TopIssues({ onSelectIssue }: TopIssuesProps) {
  return (
    <div className="flex flex-col gap-4 bg-bg-elevated rounded-2xl border border-border-default p-6 shadow-sm h-full">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Top Issues
        </h3>
        <button className="text-sm font-medium text-accent hover:text-accent-hover transition-colors">
          View All
        </button>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        {issues.map((issue) => (
          <div 
            key={issue.id}
            onClick={() => onSelectIssue(issue.id)}
            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-elevated hover:border-accent/50 transition-all cursor-pointer relative overflow-hidden"
          >
            {/* Severity Indicator */}
            <div className={clsx(
              "absolute left-0 top-0 bottom-0 w-1 transition-all",
              issue.severity === 'critical' ? "bg-negative" :
              issue.severity === 'high' ? "bg-warning" : "bg-positive"
            )} />

            <div className="flex flex-col gap-1.5 pl-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-primary group-hover:text-accent transition-colors">{issue.title}</span>
                {issue.ticketStatus === 'not-found' && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-negative opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-negative"></span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted font-medium">
                <div className="flex items-center gap-1">
                  {issue.sources.map(s => (
                    <SourceIcon key={s} source={s} />
                  ))}
                </div>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {issue.mentions} mentions
                </span>
                <span className="flex items-center gap-1">
                  {issue.trend === 'up' ? <TrendingUp className="w-3.5 h-3.5 text-negative" /> : <TrendingDown className="w-3.5 h-3.5 text-positive" />}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:ml-auto pl-2 sm:pl-0">
              <TypeBadge type={issue.type} />
              <TicketBadge status={issue.ticketStatus} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceIcon({ source }: { key?: string | number, source: string }) {
  switch (source) {
    case 'google-play': return <Smartphone className="w-3.5 h-3.5 text-positive" title="Google Play" />;
    case 'apple': return <Smartphone className="w-3.5 h-3.5 text-text-secondary" title="App Store" />;
    case 'telegram': return <MessageSquare className="w-3.5 h-3.5 text-accent" title="Telegram" />;
    case 'discord': return <Monitor className="w-3.5 h-3.5 text-ai-start" title="Discord" />;
    default: return null;
  }
}

function TypeBadge({ type }: { type: string }) {
  const styles = {
    'confirmed': 'bg-accent/10 text-accent border-accent/20',
    'chat-blind-spot': 'bg-ai-start/10 text-ai-start border-ai-start/20',
    'store-blind-spot': 'bg-warning/10 text-warning border-warning/20',
    'sentiment-gap': 'bg-negative/10 text-negative border-negative/20'
  }[type] || 'bg-bg-surface text-text-secondary border-border-subtle';

  const labels = {
    'confirmed': 'Confirmed',
    'chat-blind-spot': 'Chat Only',
    'store-blind-spot': 'Store Only',
    'sentiment-gap': 'Sentiment Gap'
  }[type] || type;

  return (
    <span className={clsx("px-2 py-1 rounded-md text-[11px] font-semibold border uppercase tracking-wider", styles)}>
      {labels}
    </span>
  );
}

function TicketBadge({ status }: { status: string }) {
  const styles = {
    'open': 'text-warning',
    'in-progress': 'text-accent',
    'resolved': 'text-positive',
    'not-found': 'text-negative'
  }[status] || 'text-text-secondary';

  const Icon = status === 'resolved' ? CheckCircle2 : status === 'not-found' ? XCircle : AlertTriangle;

  return (
    <div className={clsx("flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider", styles)} title={`TeamWork: ${status}`}>
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline-block">{status.replace('-', ' ')}</span>
    </div>
  );
}
