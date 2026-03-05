'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ExternalLink } from 'lucide-react';
import type { AppResult, ScanParams } from '@/lib/types';

interface ResultsTableProps {
  results: AppResult[];
  scanParams: ScanParams | null;
}

type SortField = keyof AppResult;
type SortOrder = 'asc' | 'desc';

interface SortButtonProps {
  field: SortField;
  label: string;
  onSort: (field: SortField) => void;
}

function SortButton({ field, label, onSort }: SortButtonProps) {
  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
}

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:51200';

export function ResultsTable({ results, scanParams }: ResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>('lead_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedResults = [...results].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === null) return 1;
    if (bVal === null) return -1;

    let comparison = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const getLeadScoreBadge = (score: number) => {
    if (score >= 70) return <Badge variant="default">High</Badge>;
    if (score >= 40) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  const buildReportUrl = (result: AppResult) => {
    const query = new URLSearchParams();
    query.set('url', result.url);
    query.set('country', scanParams?.country || 'us');
    query.set('langs', scanParams?.lang || 'en');
    query.set('maxReviews', String(scanParams?.maxReviews || 300));
    return `${DASHBOARD_URL}/report?${query.toString()}`;
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No results yet. Start a scan to see leads.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton field="developer" label="Developer" onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortButton field="title" label="Title" onSort={handleSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="no_reply_rate" label="No Reply %" onSort={handleSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="no_reply_rate_neg" label="No Reply Neg %" onSort={handleSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="unanswered_neg_30d" label="Unans. 30d" onSort={handleSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="lead_score" label="Lead Score" onSort={handleSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="score" label="Rating" onSort={handleSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="total_reviews_count" label="Reviews" onSort={handleSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="min_installs" label="Downloads" onSort={handleSort} />
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedResults.map((result, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{result.developer}</TableCell>
              <TableCell>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {result.title}
                </a>
              </TableCell>
              <TableCell className="text-right">
                {result.no_reply_rate.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right">
                {result.no_reply_rate_neg.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right">
                {result.unanswered_neg_30d}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {result.lead_score}
                  {getLeadScoreBadge(result.lead_score)}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {result.score.toFixed(1)}
              </TableCell>
              <TableCell className="text-right">
                {result.total_reviews_count.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {result.installs ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" asChild>
                  <a href={buildReportUrl(result)} target="_blank" rel="noopener noreferrer">
                    Посмотреть отчет
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
