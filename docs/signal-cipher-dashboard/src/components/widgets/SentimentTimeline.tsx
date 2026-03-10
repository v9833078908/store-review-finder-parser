import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Calendar } from 'lucide-react';

const data = [
  { date: 'Feb 19', positive: 65, negative: 20, neutral: 15 },
  { date: 'Feb 20', positive: 68, negative: 18, neutral: 14 },
  { date: 'Feb 21', positive: 62, negative: 25, neutral: 13 },
  { date: 'Feb 22', positive: 45, negative: 45, neutral: 10, event: 'v2.4.1 Release' },
  { date: 'Feb 23', positive: 30, negative: 60, neutral: 10, event: 'Server Outage' },
  { date: 'Feb 24', positive: 50, negative: 35, neutral: 15 },
  { date: 'Feb 25', positive: 56, negative: 28, neutral: 16 },
];

export function SentimentTimeline() {
  return (
    <div className="flex flex-col gap-4 bg-bg-elevated rounded-2xl border border-border-default p-6 shadow-sm h-full">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent" />
          Sentiment Timeline
        </h3>
        <div className="flex items-center gap-2 bg-bg-surface border border-border-subtle rounded-lg px-3 py-1.5 cursor-pointer hover:border-border-default transition-colors">
          <Calendar className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium">Last 7 Days</span>
        </div>
      </div>

      <div className="h-[300px] w-full mt-4 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#71717A" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
              dy={10}
            />
            <YAxis 
              stroke="#71717A" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
              tickFormatter={(value) => `${value}%`}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Annotations */}
            <ReferenceLine x="Feb 22" stroke="#06B6D4" strokeDasharray="3 3" label={{ position: 'top', value: 'v2.4.1', fill: '#06B6D4', fontSize: 11, fontWeight: 600 }} />
            <ReferenceLine x="Feb 23" stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Outage', fill: '#EF4444', fontSize: 11, fontWeight: 600 }} />

            <Area type="monotone" dataKey="positive" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#colorPositive)" />
            <Area type="monotone" dataKey="negative" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorNegative)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-bg-elevated border border-border-default p-3 rounded-lg shadow-xl flex flex-col gap-2 min-w-[150px]">
        <p className="text-sm font-semibold text-text-primary mb-1">{label}</p>
        {data.event && (
          <div className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded mb-2 inline-block">
            {data.event}
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-positive font-medium">Positive</span>
          <span className="font-mono font-bold text-text-primary">{data.positive}%</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-negative font-medium">Negative</span>
          <span className="font-mono font-bold text-text-primary">{data.negative}%</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted font-medium">Neutral</span>
          <span className="font-mono font-bold text-text-primary">{data.neutral}%</span>
        </div>
      </div>
    );
  }
  return null;
}
