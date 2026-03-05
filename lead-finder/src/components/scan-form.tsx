'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { COLLECTIONS, CATEGORIES, DEFAULTS, SUPPORTED_COUNTRIES } from '@/lib/constants';
import type { ScanParams } from '@/lib/types';

interface ScanFormProps {
  onSubmit: (params: ScanParams) => void;
  isScanning: boolean;
}

export function ScanForm({ onSubmit, isScanning }: ScanFormProps) {
  const [collection, setCollection] = useState<string>(DEFAULTS.collection);
  const [category, setCategory] = useState<string>(DEFAULTS.category);
  const [country, setCountry] = useState<string>(DEFAULTS.country);
  const [lang, setLang] = useState<string>(DEFAULTS.lang);
  const [maxApps, setMaxApps] = useState<string>(DEFAULTS.maxApps.toString());
  const [maxReviews, setMaxReviews] = useState<string>(DEFAULTS.maxReviews.toString());
  const [windowDays, setWindowDays] = useState<string>(DEFAULTS.windowDays.toString());
  const [minAgeDays, setMinAgeDays] = useState<string>(DEFAULTS.minAgeDays.toString());

  const isCountrySupported = SUPPORTED_COUNTRIES.includes(
    country as (typeof SUPPORTED_COUNTRIES)[number]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Warn if country is not supported (server will fallback to 'us')
    if (!isCountrySupported) {
      const proceed = confirm(
        `Country "${country}" is not supported and will be replaced with "us". Continue?`
      );
      if (!proceed) return;
    }

    onSubmit({
      collection,
      category: category === 'ALL' ? undefined : category,
      country,
      lang,
      maxApps: parseInt(maxApps, 10),
      maxReviews: parseInt(maxReviews, 10),
      windowDays: parseInt(windowDays, 10),
      minAgeDays: parseInt(minAgeDays, 10),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Collection</label>
          <Select value={collection} onValueChange={setCollection}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLLECTIONS.map(col => (
                <SelectItem key={col.value} value={col.value}>
                  {col.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Country</label>
          <Input
            value={country}
            onChange={e => setCountry(e.target.value.toLowerCase())}
            placeholder="us, gb, de, fr, etc."
            maxLength={2}
            className={!isCountrySupported && country ? 'border-yellow-500' : ''}
          />
          <p className="text-xs text-muted-foreground">
            Supported: us, gb, de, fr, es, it, jp, kr, cn, in, br, ca, au, mx, nl, se, no, dk, fi, pl, ru
          </p>
          {!isCountrySupported && country && (
            <p className="text-xs text-yellow-600">
              ⚠️ Country not supported, will fallback to &quot;us&quot;
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Language</label>
          <Input
            value={lang}
            onChange={e => setLang(e.target.value.toLowerCase())}
            placeholder="en"
            maxLength={2}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Max Apps</label>
          <Input
            type="number"
            value={maxApps}
            onChange={e => setMaxApps(e.target.value)}
            min={1}
            max={200}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Max Reviews per App</label>
          <Input
            type="number"
            value={maxReviews}
            onChange={e => setMaxReviews(e.target.value)}
            min={10}
            max={500}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Window Days</label>
          <Input
            type="number"
            value={windowDays}
            onChange={e => setWindowDays(e.target.value)}
            min={1}
            max={365}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Min Age Days</label>
          <Input
            type="number"
            value={minAgeDays}
            onChange={e => setMinAgeDays(e.target.value)}
            min={0}
            max={30}
          />
        </div>
      </div>

      <Button type="submit" disabled={isScanning} className="w-full">
        {isScanning ? 'Scanning...' : 'Start Scan'}
      </Button>
    </form>
  );
}
