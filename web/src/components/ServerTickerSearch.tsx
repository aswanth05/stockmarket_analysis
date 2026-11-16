import { useEffect, useRef, useState } from 'react';
import type { SearchResult } from '@ust/shared';
import { apiGet } from '../api/client';
import { TickerSearch, type TickerOption } from './TickerSearch';

/** Ticker/company autocomplete backed by the server's stored NYSE and Nasdaq list. */
export function ServerTickerSearch({ onSelect, label }: { onSelect: (o: TickerOption) => void; label?: string }) {
  const [options, setOptions] = useState<TickerOption[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const onQuery = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) return;
    timer.current = setTimeout(() => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      apiGet<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(q.trim())}`, c.signal)
        .then((r) => setOptions(r.results.map((x) => ({ ticker: x.ticker, name: x.exchange ? `${x.name} · ${x.exchange}` : x.name }))))
        .catch(() => undefined);
    }, 150);
  };

  return <TickerSearch options={options} onSelect={onSelect} onQueryChange={onQuery} label={label} />;
}
