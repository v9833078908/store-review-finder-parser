import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './components/Dashboard';
import { AIBar } from './components/AIBar';
import { OverlayPanel } from './components/OverlayPanel';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg-base text-text-primary">
      <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex flex-col flex-1 min-w-0 relative">
        <Topbar />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24">
          <Dashboard onSelectIssue={setSelectedIssue} />
        </main>

        <AIBar />
      </div>

      <OverlayPanel 
        isOpen={!!selectedIssue} 
        onClose={() => setSelectedIssue(null)} 
        issueId={selectedIssue} 
      />
    </div>
  );
}
