import { useState, type ReactNode } from 'react';
import { AIReviewBox } from '../components/AIReviewBox';
import { ChangeValue } from '../components/ChangeValue';
import { ChartPanel, type Range } from '../components/ChartPanel';
import { DataTable, type Column } from '../components/DataTable';
import { FormulaTooltip } from '../components/FormulaTooltip';
import { FreshnessBadge } from '../components/FreshnessBadge';
import { MarketStatusPill } from '../components/MarketStatusPill';
import { SourceChip } from '../components/SourceChip';
import { Sparkline } from '../components/Sparkline';
import { SummaryCard } from '../components/SummaryCard';
import { TickerSearch, type TickerOption } from '../components/TickerSearch';
import { DataGapNotice, EmptyState, ErrorState, LoadingSkeleton } from '../components/states/States';
import { formatPrice } from '../format';

/*
 * Component examples for step 27. Every value here is made-up sample data with
 * placeholder tickers, so nothing can be mistaken for a real quote.
 */
const SAMPLE_TIME = '2026-11-13T21:00:00Z';

interface SampleRow {
  ticker: string;
  name: string;
  price: number | null;
  changePct: number | null;
  trend: number[];
}

const ROWS: SampleRow[] = [
  { ticker: 'SMPA', name: 'Sample Co A', price: 182.4, changePct: 1.24, trend: [3, 4, 3.5, 5, 6] },
  { ticker: 'SMPB', name: 'Sample Co B', price: 47.1, changePct: -0.86, trend: [6, 5, 5.5, 4, 3.8] },
  { ticker: 'SMPC', name: 'Sample Co C', price: null, changePct: null, trend: [] },
  { ticker: 'SMPD', name: 'Sample Co D', price: 310.05, changePct: 0, trend: [4, 4.2, 3.9, 4.1, 4] },
];

const OPTIONS: TickerOption[] = ROWS.map(({ ticker, name }) => ({ ticker, name }));

const COLUMNS: Column<SampleRow>[] = [
  { key: 'ticker', header: 'Ticker', sortValue: (r) => r.ticker, render: (r) => <span className="num">{r.ticker}</span> },
  { key: 'name', header: 'Company', render: (r) => r.name },
  { key: 'price', header: 'Last', numeric: true, sortValue: (r) => r.price, render: (r) => formatPrice(r.price) },
  { key: 'chg', header: 'Change', numeric: true, sortValue: (r) => r.changePct, render: (r) => <ChangeValue pct={r.changePct} /> },
  {
    key: 'trend',
    header: '5-day',
    render: (r) => (r.trend.length ? <Sparkline values={r.trend} label={`${r.ticker} 5-day trend`} width={80} height={24} /> : '—'),
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--space-8)' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>{title}</h2>
      {children}
    </section>
  );
}

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 'var(--space-4)',
} as const;

const row = { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' } as const;

export function Gallery() {
  const [range, setRange] = useState<Range>('1M');
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div>
      <p className="pill" style={{ color: 'var(--color-warn)', whiteSpace: 'normal', marginBottom: 'var(--space-6)' }}>
        Sample values for layout only. Not market data. Design tokens are provisional until the design is approved.
      </p>

      <Section title="Market status pill">
        <div style={row}>
          <MarketStatusPill status="open" etTime="10:42 AM" />
          <MarketStatusPill status="closed" etTime="8:15 PM" />
          <MarketStatusPill status="pre-market" etTime="7:05 AM" />
          <MarketStatusPill status="after-hours" etTime="5:30 PM" />
        </div>
      </Section>

      <Section title="Freshness badge">
        <div style={row}>
          <FreshnessBadge freshness="real-time" asOf={SAMPLE_TIME} />
          <FreshnessBadge freshness="delayed" delayMinutes={15} asOf={SAMPLE_TIME} />
          <FreshnessBadge freshness="stale" asOf={SAMPLE_TIME} />
        </div>
      </Section>

      <Section title="Summary cards">
        <div style={grid}>
          <SummaryCard
            title="Sample index proxy"
            value={formatPrice(512.34)}
            changePct={0.42}
            sparkline={[1, 2, 1.6, 2.4, 3, 2.8, 3.4]}
            asOf={SAMPLE_TIME}
            source="Sample source"
            badge={<FreshnessBadge freshness="delayed" delayMinutes={15} asOf={SAMPLE_TIME} />}
          />
          <SummaryCard
            title="Sample breadth"
            value="312 ▲ / 188 ▼"
            sparkline={[5, 4, 4.5, 3.8, 3.2]}
            asOf={SAMPLE_TIME}
            source="Sample source"
          />
          <SummaryCard title="Sample with missing data" value={null} asOf={SAMPLE_TIME} source="Sample source" />
        </div>
      </Section>

      <Section title="Chart panel">
        <ChartPanel
          title="Sample chart"
          range={range}
          onRangeChange={setRange}
          disabledRanges={{ '1H': 'no intraday data on the current plan' }}
          dataTimeLabel="Delayed 15 min · last point Nov 13, 4:00 PM ET (sample)"
          summary="Sample line rising over the selected range."
        >
          <div style={{ padding: 'var(--space-4) 0' }}>
            <Sparkline values={[2, 3, 2.5, 4, 3.6, 5, 5.4, 6]} label="Sample chart line" width={480} height={120} />
          </div>
          <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>
            Selected range: {range}. Candle charts arrive in step 36.
          </div>
        </ChartPanel>
      </Section>

      <Section title="Source chip and formula tooltip">
        <div style={row}>
          <SourceChip source="EDGAR" form="10-K" filed="2026-02-14" href="https://www.sec.gov/edgar/search/" />
          <SourceChip source="Sample provider" />
          <span>
            Net margin:{' '}
            <FormulaTooltip
              formula="Net margin = Net income ÷ Revenue"
              inputs={[
                { label: 'Net income', value: '$1,200M' },
                { label: 'Revenue', value: '$8,000M' },
              ]}
              period="FY ending 2025-12-31"
              source="EDGAR 10-K (sample)"
            >
              15.0%
            </FormulaTooltip>
          </span>
        </div>
      </Section>

      <Section title="AI review box">
        <div style={grid}>
          <AIReviewBox
            evidenceDate="2026-11-13"
            sourceCount={4}
            status="draft"
            score={62}
            method="Weighted factor score v0 (sample)"
            summary="Sample explanation text. Real reviews explain stored evidence only."
          />
          <AIReviewBox evidenceDate={null} sourceCount={0} status="not available" />
        </div>
      </Section>

      <Section title="Sortable data table">
        <div className="card">
          <DataTable caption="Sample tickers" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.ticker} />
        </div>
      </Section>

      <Section title="Ticker search">
        <div style={{ maxWidth: 360 }}>
          <TickerSearch options={OPTIONS} onSelect={(o) => setPicked(o.ticker)} />
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }} aria-live="polite">
            {picked ? `Selected ${picked}` : 'Try typing "smp" or "co b".'}
          </p>
        </div>
      </Section>

      <Section title="States">
        <div style={grid}>
          <EmptyState title="Your watchlist is empty">Search for a company to add it.</EmptyState>
          <LoadingSkeleton />
          <ErrorState
            what="Quotes could not be refreshed."
            next="Showing the last stored values. Check your connection and try again."
            onRetry={() => undefined}
          />
          <div className="card">
            <DataGapNotice>free cash flow needs both operating cash flow and capital spending.</DataGapNotice>
          </div>
        </div>
      </Section>
    </div>
  );
}
