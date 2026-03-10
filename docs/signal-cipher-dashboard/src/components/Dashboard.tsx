import { HealthScore } from './widgets/HealthScore';
import { TopIssues } from './widgets/TopIssues';
import { ChannelMix } from './widgets/ChannelMix';
import { SentimentTimeline } from './widgets/SentimentTimeline';
import { AIInsights } from './widgets/AIInsights';
import { RecentFeedback } from './widgets/RecentFeedback';
import { AlertBanner } from './widgets/AlertBanner';

interface DashboardProps {
  onSelectIssue: (id: string) => void;
}

export function Dashboard({ onSelectIssue }: DashboardProps) {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <AlertBanner />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hero Section */}
        <div className="col-span-1 lg:col-span-12">
          <HealthScore />
        </div>

        {/* Bento Grid Row 1 */}
        <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
          <TopIssues onSelectIssue={onSelectIssue} />
        </div>
        <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          <ChannelMix />
        </div>

        {/* Bento Grid Row 2 */}
        <div className="col-span-1 lg:col-span-12">
          <SentimentTimeline />
        </div>

        {/* Bento Grid Row 3 */}
        <div className="col-span-1 lg:col-span-6 flex flex-col gap-6">
          <AIInsights />
        </div>
        <div className="col-span-1 lg:col-span-6 flex flex-col gap-6">
          <RecentFeedback onSelectIssue={onSelectIssue} />
        </div>
      </div>
    </div>
  );
}
