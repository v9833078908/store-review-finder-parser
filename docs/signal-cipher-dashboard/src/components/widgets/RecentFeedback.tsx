import { MessageSquare, Smartphone, Monitor, Star, Clock } from 'lucide-react';
import { clsx } from 'clsx';

interface RecentFeedbackProps {
  onSelectIssue: (id: string) => void;
}

const feedback = [
  {
    id: 'f1',
    source: 'google-play',
    author: 'Alex M.',
    text: 'Game crashes every time I try to open the new map. Samsung S24 Ultra.',
    rating: 1,
    tag: 'Bug',
    time: '2m ago',
    sentiment: 'negative'
  },
  {
    id: 'f2',
    source: 'telegram',
    author: 'SniperKing99',
    text: 'The new battle pass is actually pretty good, rewards are much better than last season.',
    rating: null,
    tag: 'Praise',
    time: '15m ago',
    sentiment: 'positive'
  },
  {
    id: 'f3',
    source: 'discord',
    author: 'NoobMaster',
    text: 'Can we please get a nerf on the sniper rifle? It\'s impossible to play PvP right now.',
    rating: null,
    tag: 'Feature Request',
    time: '1h ago',
    sentiment: 'neutral'
  },
  {
    id: 'f4',
    source: 'apple',
    author: 'Anonymous',
    text: 'Love the graphics but the loading times are insane.',
    rating: 3,
    tag: 'Complaint',
    time: '2h ago',
    sentiment: 'neutral'
  }
];

export function RecentFeedback({ onSelectIssue }: RecentFeedbackProps) {
  return (
    <div className="flex flex-col gap-4 bg-bg-elevated rounded-2xl border border-border-default p-6 shadow-sm h-full">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-text-secondary" />
          Live Feed
        </h3>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-positive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-positive"></span>
          </span>
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Live</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-2 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
        {feedback.map((item) => (
          <div 
            key={item.id}
            onClick={() => onSelectIssue(item.id)}
            className="group flex flex-col gap-2 p-4 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-elevated hover:border-border-default transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SourceIcon source={item.source} />
                <span className="text-sm font-semibold text-text-primary">{item.author}</span>
                {item.rating && (
                  <div className="flex items-center gap-0.5 ml-2">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={clsx(
                          "w-3 h-3",
                          i < item.rating! ? "text-warning fill-warning" : "text-border-default"
                        )} 
                      />
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs font-medium text-text-muted">{item.time}</span>
            </div>
            
            <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed group-hover:text-text-primary transition-colors">
              "{item.text}"
            </p>
            
            <div className="flex items-center gap-2 mt-1">
              <span className={clsx(
                "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border",
                item.sentiment === 'positive' ? "bg-positive/10 text-positive border-positive/20" :
                item.sentiment === 'negative' ? "bg-negative/10 text-negative border-negative/20" :
                "bg-border-subtle text-text-secondary border-border-default"
              )}>
                {item.tag}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceIcon({ source }: { source: string }) {
  switch (source) {
    case 'google-play': return <Smartphone className="w-4 h-4 text-positive" title="Google Play" />;
    case 'apple': return <Smartphone className="w-4 h-4 text-text-secondary" title="App Store" />;
    case 'telegram': return <MessageSquare className="w-4 h-4 text-accent" title="Telegram" />;
    case 'discord': return <Monitor className="w-4 h-4 text-ai-start" title="Discord" />;
    default: return null;
  }
}
