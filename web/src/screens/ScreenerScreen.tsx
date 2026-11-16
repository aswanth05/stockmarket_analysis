import { useMemo, useState, type FormEvent } from 'react';
import type { ScreenerFilters, ScreenerResponse, ScreenerRow } from '@ust/shared';
import { useApi } from '../api/useApi';
import { ChangeValue } from '../components/ChangeValue';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states/States';
import { formatPrice, formatRatioPct, MISSING } from '../format';

export const SECTORS = [
  'Communication Services',
  'Consumer Discretionary',
  'Consumer Staples',
  'Energy',
  'Financials',
  'Health Care',
  'Industrials',
  'Information Technology',
  'Materials',
  'Real Estate',
  'Utilities',
];

type Key = keyof ScreenerFilters;
const LABELS: Record<Key, (v: unknown) => string> = {
  sector: (v) => `Sector: ${v}`,
  minPrice: (v) => `Price ≥ $${v}`,
  maxPrice: (v) => `Price ≤ $${v}`,
  minChangePct: (v) => `Today’s change ≥ ${v}%`,
  maxChangePct: (v) => `Today’s change ≤ ${v}%`,
  aboveMa50: (v) => (v ? 'Above 50-day average' : 'Below 50-day average'),
  minRevenueGrowth: (v) => `Revenue growth ≥ ${v}%`,
  minNetMargin: (v) => `Net margin ≥ ${v}%`,
};

const toQuery = (f: ScreenerFilters) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') q.set(k, String(v));
  return q.toString();
};

const COLUMNS: Column<ScreenerRow>[] = [
  { key: 'ticker', header: 'Ticker', sortValue: (r) => r.ticker, render: (r) => <a className="num ticker" href={`#/research/${r.ticker}`}>{r.ticker}</a> },
  { key: 'name', header: 'Company', sortValue: (r) => r.name, render: (r) => r.name },
  { key: 'sector', header: 'Sector', sortValue: (r) => r.sector, render: (r) => <span className="muted">{r.sector}</span> },
  { key: 'price', header: 'Last', numeric: true, sortValue: (r) => r.quote.price, render: (r) => formatPrice(r.quote.price) },
  { key: 'chg', header: 'Today', numeric: true, sortValue: (r) => r.quote.changePct, render: (r) => <ChangeValue pct={r.quote.changePct} /> },
  { key: 'ma50', header: 'vs 50-day', sortValue: (r) => (r.aboveMa50 == null ? null : r.aboveMa50 ? 1 : 0), render: (r) => (r.aboveMa50 == null ? MISSING : r.aboveMa50 ? 'Above' : 'Below') },
  { key: 'growth', header: 'Rev. growth', numeric: true, sortValue: (r) => r.revenueGrowth, render: (r) => formatRatioPct(r.revenueGrowth) },
  { key: 'margin', header: 'Net margin', numeric: true, sortValue: (r) => r.netMargin, render: (r) => formatRatioPct(r.netMargin) },
];

export function ScreenerScreen() {
  const [draft, setDraft] = useState<ScreenerFilters>({});
  const [applied, setApplied] = useState<ScreenerFilters>({});
  const query = useMemo(() => toQuery(applied), [applied]);
  const { data, error, loading, reload } = useApi<ScreenerResponse>(`/screener?${query}`, 60_000);

  const set = (k: Key, v: string) => {
    const val = v === '' ? undefined : k === 'sector' ? v : k === 'aboveMa50' ? v === 'true' : Number(v);
    setDraft((d) => ({ ...d, [k]: val }));
  };
  const apply = (e: FormEvent) => {
    e.preventDefault();
    setApplied(draft);
  };
  const remove = (k: Key) => {
    const next = { ...applied };
    delete next[k];
    setApplied(next);
    setDraft(next);
  };
  const active = (Object.keys(applied) as Key[]).filter((k) => applied[k] !== undefined);
  const val = (k: Key) => (draft[k] === undefined ? '' : String(draft[k]));

  return (
    <div className="screener">
      <form className="card filter-panel" onSubmit={apply} aria-label="Filters">
        <h2 className="card-title">Filters</h2>
        <label className="field">
          <span>Sector</span>
          <select value={val('sector')} onChange={(e) => set('sector', e.target.value)}>
            <option value="">All sectors</option>
            {SECTORS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <fieldset className="field-pair">
          <legend>Last price (USD)</legend>
          <input type="number" inputMode="decimal" min="0" placeholder="Min" aria-label="Minimum price" value={val('minPrice')} onChange={(e) => set('minPrice', e.target.value)} />
          <input type="number" inputMode="decimal" min="0" placeholder="Max" aria-label="Maximum price" value={val('maxPrice')} onChange={(e) => set('maxPrice', e.target.value)} />
        </fieldset>
        <fieldset className="field-pair">
          <legend>Today’s change (%)</legend>
          <input type="number" inputMode="decimal" step="0.1" placeholder="Min" aria-label="Minimum change percent" value={val('minChangePct')} onChange={(e) => set('minChangePct', e.target.value)} />
          <input type="number" inputMode="decimal" step="0.1" placeholder="Max" aria-label="Maximum change percent" value={val('maxChangePct')} onChange={(e) => set('maxChangePct', e.target.value)} />
        </fieldset>
        <label className="field">
          <span>Trend</span>
          <select value={val('aboveMa50')} onChange={(e) => set('aboveMa50', e.target.value)}>
            <option value="">Any</option>
            <option value="true">Above 50-day average</option>
            <option value="false">Below 50-day average</option>
          </select>
        </label>
        <label className="field">
          <span>Minimum revenue growth (%)</span>
          <input type="number" inputMode="decimal" step="1" value={val('minRevenueGrowth')} onChange={(e) => set('minRevenueGrowth', e.target.value)} />
        </label>
        <label className="field">
          <span>Minimum net margin (%)</span>
          <input type="number" inputMode="decimal" step="1" value={val('minNetMargin')} onChange={(e) => set('minNetMargin', e.target.value)} />
        </label>
        <div className="row-gap">
          <button className="btn" type="submit">Apply filters</button>
          <button className="btn btn-ghost" type="button" onClick={() => { setDraft({}); setApplied({}); }}>
            Reset
          </button>
        </div>
        <p className="data-time">A company with missing data never passes a filter that needs it.</p>
      </form>

      <section className="card results-panel" aria-label="Results">
        <div className="chip-row" aria-label="Active filters">
          {active.length ? (
            active.map((k) => (
              <button key={k} type="button" className="pill filter-chip" onClick={() => remove(k)} aria-label={`Remove filter ${LABELS[k](applied[k])}`}>
                {LABELS[k](applied[k])} <span aria-hidden="true">×</span>
              </button>
            ))
          ) : (
            <span className="muted">No filters: showing the whole saved S&P 500 list.</span>
          )}
        </div>
        {loading && !data ? (
          <LoadingSkeleton lines={8} label="Loading results" />
        ) : !data ? (
          <ErrorState what="Results could not be loaded." next={error ?? ''} onRetry={reload} />
        ) : (
          <>
            <p className="results-count" aria-live="polite">
              <strong>{data.rows.length}</strong> of {data.total} companies · {data.universe}
            </p>
            {data.rows.length ? (
              <div className="table-scroll">
                <DataTable caption="Screener results" columns={COLUMNS} rows={data.rows} rowKey={(r) => r.ticker} />
              </div>
            ) : (
              <EmptyState title="No companies match">Try removing a filter.</EmptyState>
            )}
            <p className="data-time">{data.fundamentalsNote}</p>
          </>
        )}
      </section>
    </div>
  );
}
