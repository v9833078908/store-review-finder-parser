import { Sparkles, Send } from 'lucide-react';

export function AIBar() {
  return (
    <div className="fixed bottom-0 left-16 lg:left-60 right-0 p-4 bg-gradient-to-t from-bg-base via-bg-base/90 to-transparent pointer-events-none z-20 transition-all duration-300">
      <div className="max-w-3xl mx-auto pointer-events-auto">
        <div className="relative group ai-border rounded-full shadow-2xl bg-bg-elevated/80 backdrop-blur-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Sparkles className="w-5 h-5 text-ai-start group-focus-within:text-ai-end transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="Ask about your players, sentiment trends, or specific issues..." 
            className="w-full bg-transparent border-none rounded-full pl-12 pr-16 py-4 text-sm focus:outline-none focus:ring-0 text-text-primary placeholder:text-text-muted transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button className="p-2 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-bg-base transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2 mt-3 overflow-x-auto no-scrollbar px-2">
          <Suggestion text="Summarize latest reviews" />
          <Suggestion text="Why did sentiment drop yesterday?" />
          <Suggestion text="Compare iOS vs Android" />
        </div>
      </div>
    </div>
  );
}

function Suggestion({ text }: { text: string }) {
  return (
    <button className="whitespace-nowrap px-3 py-1.5 rounded-full border border-border-subtle bg-bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-bg-elevated transition-all">
      {text}
    </button>
  );
}
