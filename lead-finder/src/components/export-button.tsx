'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { generateCsv, downloadCsv } from '@/lib/csv';
import type { AppResult } from '@/lib/types';

interface ExportButtonProps {
  results: AppResult[];
}

export function ExportButton({ results }: ExportButtonProps) {
  const handleExport = () => {
    if (results.length === 0) return;

    const csv = generateCsv(results);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `leads-${timestamp}.csv`;
    downloadCsv(csv, filename);
  };

  return (
    <Button
      onClick={handleExport}
      disabled={results.length === 0}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Export CSV ({results.length})
    </Button>
  );
}
