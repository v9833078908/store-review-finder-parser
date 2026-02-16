'use client';

import { useState, useRef } from 'react';
import { ScanForm } from '@/components/scan-form';
import { ProgressPanel } from '@/components/progress-panel';
import { ResultsTable } from '@/components/results-table';
import { ExportButton } from '@/components/export-button';
import type { ScanParams, ScanEvent, AppResult } from '@/lib/types';

type ScanState = 'idle' | 'scanning' | 'done' | 'error';

export default function Home() {
  const [state, setState] = useState<ScanState>('idle');
  const [results, setResults] = useState<AppResult[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentApp, setCurrentApp] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastScanParams, setLastScanParams] = useState<ScanParams | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleScan = (params: ScanParams) => {
    setLastScanParams(params);
    // Reset state
    setState('scanning');
    setResults([]);
    setProgress({ current: 0, total: 0 });
    setCurrentApp('');
    setStartTime(Date.now());
    setErrors([]);

    // Build query string
    const query = new URLSearchParams();
    query.set('collection', params.collection);
    if (params.category && params.category !== 'undefined') {
      query.set('category', params.category);
    }
    query.set('country', params.country);
    query.set('lang', params.lang);
    query.set('maxApps', params.maxApps.toString());
    query.set('maxReviews', params.maxReviews.toString());
    query.set('windowDays', params.windowDays.toString());
    query.set('minAgeDays', params.minAgeDays.toString());

    // Create EventSource
    const eventSource = new EventSource(`/api/scan?${query.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: ScanEvent = JSON.parse(event.data);

        switch (data.type) {
          case 'progress':
            setProgress({ current: data.current, total: data.total });
            setCurrentApp(`${data.title} (${data.appId})`);
            break;

          case 'result':
            setResults(prev => [...prev, data.data]);
            break;

          case 'error':
            setErrors(prev => [...prev, data.message]);
            break;

          case 'done':
            setState('done');
            eventSource.close();
            break;
        }
      } catch (error) {
        console.error('[SSE] Error parsing event:', error, event.data);
        setErrors(prev => [...prev, `Parse error: ${error}`]);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      setState('error');
      eventSource.close();
    };
  };

  const handleStop = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState('done');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Lead Finder</h1>
          <p className="text-muted-foreground">
            Find games with low developer reply rates on Google Play
          </p>
        </header>

        <div className="space-y-8">
          {/* Scan Form */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Scan Parameters</h2>
            <ScanForm onSubmit={handleScan} isScanning={state === 'scanning'} />
          </div>

          {/* Progress Panel */}
          {state === 'scanning' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Scanning...</h2>
                <button
                  onClick={handleStop}
                  className="text-sm text-destructive hover:underline"
                >
                  Stop Scan
                </button>
              </div>
              <ProgressPanel
                current={progress.current}
                total={progress.total}
                currentApp={currentApp}
                startTime={startTime}
              />
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="border rounded-lg p-4 bg-destructive/10">
              <h3 className="font-semibold mb-2 text-destructive">Errors ({errors.length})</h3>
              <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                {errors.map((error, i) => (
                  <li key={i} className="text-muted-foreground">{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  Results ({results.length})
                </h2>
                <ExportButton results={results} />
              </div>
              <ResultsTable results={results} scanParams={lastScanParams} />
            </div>
          )}

          {/* Empty State */}
          {state === 'idle' && results.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p>Configure your scan parameters and click Start Scan to begin.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
