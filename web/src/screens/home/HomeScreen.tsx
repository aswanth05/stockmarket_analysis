import { useState } from 'react';
import type { HomeResponse, MarketRow } from '@ust/shared';
import { useApi } from '../../api/useApi';
import { AIReviewBox } from '../../components/AIReviewBox';
import { ChangeValue } from '../../components/ChangeValue';
import { ChartPanel, type Range } from '../../components/ChartPanel';
import { DataTable, type Column } from '../../components/DataTable';
import { FreshnessBadge } from '../../components/FreshnessBadge';
import { ProviderNotice } from '../../components/ProviderNotice';
import { SourceChip } from '../../components/SourceChip';
import { Sparkline } from '../../components/Sparkline';
import { SummaryCard } from '../../components/SummaryCard';
import { BreadthGauge } from '../../components/charts/BreadthGauge';
import { DonutChart } from '../../components/charts/DonutChart';
import { GroupedBars } from '../../components/charts/GroupedBars';
import { LineChart } from '../../components/charts/LineChart';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/states/States';
import { formatChangePct, formatDate, formatPrice } from '../../format';
import { useMarket } from '../../layout/MarketContext';
import { DailyChartCard } from '../research/DailyChartCard';

const RANGE_DAYS: Partial<Record<Range, number>> = { '1W': 5, '1M': 21, '3M': 63, '1Y': 252 };
const NO_INTRADAY = 'the app stores daily prices only';
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

export const MARKET_COLUMNS: Column<MarketRow>[] = [
  { key: 'ticker', header: 'Ticker', sortValue: (r) => r.ticker, render: (r) => <a className="num ticker" href={`#/research/${r.ticker}`}>{r.ticker}</a> },
  { key: 'name', header: 'Name', render: (r) => <span className="cell-name">{r.name}{r.kind === 'ETF' && <span className="tag">ETF</span>}</span> },
  { key: 'price', header: 'Last', numeric: true, sortValue: (r) => r.quote.price, render: (r) => formatPrice(r.quote.price) },
  { key: 'chg', header: 'Change', numeric: true, sortValue: (r) => r.quote.changePct, render: (r) => <ChangeValue pct={r.quote.changePct} /> },
  {
    key: 'fresh',
    header: 'Data',
    render: (r) => (r.quote.freshness && r.quote.asOf ? <FreshnessBadge freshness={r.quote.freshness} asOf={r.quote.asOf} delayMinutes={r.quote.delayMinutes} /> : <span className="muted">—</span>),
  },
  {
    key: 'trend',
    header: '10-day',
    render: (r) =>
      r.trend.length > 1 ? <Sparkline values={r.trend} label={`${r.ticker} 10-day closes, ${formatChangePct(r.quote.changePct).spoken} today`} width={80} height={24} /> : <span className="muted">—</span>,
  },
];

export function HomeScreen() {
  const { data, error, loading, reload } = useApi<HomeResponse>('/home', 60_000);
  const market = useMarket();
  const [proxy, setProxy] = useState('SPY');
  const [range, setRange] = useState<Range>('3M');

  if (loading && !data) return <LoadingSkeleton lines={6} label="Loading Home" />;
  if (!data) return <ErrorState what="Home could not be loaded." next={error ?? 'Try again.'} onRetry={reload} />;

  const series = data.proxies.find((p) => p.ticker === proxy) ?? data.proxies[0]!;
  const points = series.closes.slice(-(RANGE_DAYS[range] ?? 63));
  const first = points[0]?.value ?? null;
  const last = points.at(-1)?.value ?? null;
  const rangeChange = first && last ? Math.round(((last - first) / first) * 10000) / 100 : null;
  const spy = data.proxies.find((p) => p.ticker === 'SPY')!;
  const quoteSource = data.topMarkets.find((r) => r.quote.source)?.quote.source ?? null;
  const b = data.breadth;
  const hasBreadth = b.advancing + b.declining + b.unchanged > 0;
  const firstWatch = data.topMarkets[0]?.ticker ?? 'AAPL';

  return (
    <div className="home-grid">
      <div className="span-12">
        <ProviderNotice providers={data.providers} need={['alpaca', 'edgar']} />
        {error && <p className="form-error" role="alert">Latest refresh failed: {error}. Showing the last loaded data.</p>}
      </div>

      <div className="span-3">
        <SummaryCard
          title="S&P 500 (SPY proxy)"
          value={spy.quote.price == null ? null : formatPrice(spy.quote.price)}
          changePct={spy.quote.changePct}
          sparkline={spy.closes.slice(-20).map((c) => c.value)}
          asOf={spy.quote.asOf ?? ''}
          source={spy.quote.source ?? 'no quote stored'}
          badge={spy.quote.freshness && spy.quote.asOf ? <FreshnessBadge freshness={spy.quote.freshness} asOf={spy.quote.asOf} delayMinutes={spy.quote.delayMinutes} /> : undefined}
        />
      </div>
      <div className="span-3">
        <SummaryCard
          title="Market breadth"
          value={hasBreadth ? `${b.advancing}▲ ${b.declining}▼` : null}
          asOf={b.asOf ?? ''}
          source={`${quoteSource ?? 'no quotes stored'} · ${b.listSize - b.noData} of ${b.listSize} in saved S&P 500 list`}
        />
      </div>
      <div className="span-3">
        <SummaryCard
          title="Watchlist: new filings (7 days)"
          value={data.watchlist.count ? `${data.watchlist.withNewFiling} of ${data.watchlist.count}` : null}
          asOf={data.recentFilings[0] ? `${data.recentFilings[0].filed}T12:00:00Z` : ''}
          source={data.providers.edgar ? 'SEC EDGAR' : 'SEC EDGAR not connected'}
        />
      </div>
      <div className="span-3">
        <SummaryCard title="Watchlist companies" value={String(data.watchlist.count)} asOf={new Date().toISOString()} source="Your account" />
      </div>

      <div className="span-8">
        <ChartPanel
          title="Index ETF proxies"
          range={range}
          onRangeChange={setRange}
          disabledRanges={{ '1H': NO_INTRADAY, '1D': NO_INTRADAY }}
          dataTimeLabel={points.length ? `End-of-day closes · last point ${formatDate(points.at(-1)!.date)} · ETFs shown as proxies for the indexes` : 'No daily prices stored yet'}
          summary={`${series.label} proxy ${series.ticker}: ${rangeChange == null ? 'no data' : formatChangePct(rangeChange).spoken} over ${range}.`}
        >
          <div className="proxy-row">
            <div className="tabs" role="group" aria-label="Index proxy">
              {data.proxies.map((p) => (
                <button key={p.ticker} type="button" className="tab" aria-pressed={p.ticker === series.ticker} onClick={() => setProxy(p.ticker)}>
                  {p.label} <span className="num">({p.ticker})</span>
                </button>
              ))}
            </div>
            <span className="tag">ETF proxy</span>
            {last != null && (
              <span className="proxy-figure">
                <span className="num">{formatPrice(last)}</span> <ChangeValue pct={rangeChange} />
                <span className="muted"> over {range}</span>
              </span>
            )}
          </div>
          {points.length > 1 ? (
            <LineChart points={points} format={(v) => `$${v.toFixed(0)}`} label={`${series.label} proxy ${series.ticker} closing prices over ${range}`} />
          ) : (
            <EmptyState title="No price history yet">Daily prices appear once market data is connected.</EmptyState>
          )}
        </ChartPanel>
      </div>
      <div className="span-4">
        <section className="card" aria-label="Sector breakdown">
          <h3 className="card-title">Sector breakdown</h3>
          <p className="card-sub">Saved S&P 500 list, by number of companies</p>
          <DonutChart slices={data.sectorCounts.slice(0, 6).map((s) => ({ label: s.sector, value: s.count })).concat(
            data.sectorCounts.length > 6 ? [{ label: `Other ${data.sectorCounts.length - 6} sectors`, value: data.sectorCounts.slice(6).reduce((a, s) => a + s.count, 0) }] : [],
          )} lastIsOther={data.sectorCounts.length > 6} centerLabel="sectors" format={(v) => `${v} cos.`} />
          <div className="data-time">Saved list · Wikipedia, List of S&P 500 companies</div>
        </section>
      </div>

      <div className="span-4">
        <section className="card" aria-label="Market breadth gauge">
          <h3 className="card-title">Market breadth</h3>
          <p className="card-sub">Our own measure, not a third-party sentiment index</p>
          <BreadthGauge pct={data.above50.pct} definition="Share of saved S&P 500 stocks closing above their 50-day average" />
          <div className="data-time">
            {data.above50.pct == null
              ? `Not enough data: ${data.above50.counted} of ${data.above50.listSize} stocks have 50 days of prices`
              : `Closes as of ${formatDate(data.above50.asOf)} · ${data.above50.counted} stocks counted`}
          </div>
        </section>
      </div>
      <div className="span-8">
        <section className="card" aria-label="Top markets">
          <h3 className="card-title">Top markets</h3>
          <p className="card-sub">Large US companies and the index ETFs (a fixed list, not a ranking)</p>
          <div className="table-scroll">
            <DataTable caption="Top US stocks and ETFs" columns={MARKET_COLUMNS} rows={data.topMarkets} rowKey={(r) => r.ticker} />
          </div>
          <div className="data-time">{quoteSource ? `Prices: ${quoteSource} · a dash means no data, never zero` : 'No prices stored yet'}</div>
        </section>
      </div>

      <div className="span-8">
        <DailyChartCard ticker={firstWatch} pickable />
      </div>
      <div className="span-4">
        {data.aiReview ? (
          <AIReviewBox
            evidenceDate={data.aiReview.evidenceDate}
            sourceCount={data.aiReview.sources.length}
            status="reviewed"
            summary={`${data.aiReview.ticker}: ${data.aiReview.summary}`}
            method={`Written by ${data.aiReview.model} on ${formatDate(data.aiReview.createdAt)} from stored evidence`}
          />
        ) : (
          <AIReviewBox evidenceDate={null} sourceCount={0} status="not available" summary="No AI review yet. Open a company in Stock Research to create one." />
        )}
      </div>

      <div className="span-6">
        <section className="card" aria-label="Weekly comparison">
          <h3 className="card-title">Weekly comparison: sector returns</h3>
          {data.weekly.rows.length ? (
            <GroupedBars
              groups={data.weekly.rows.map((s) => ({ label: s.sector.replace('Information Technology', 'Info Tech').replace('Communication Services', 'Comm Svcs').replace('Consumer Discretionary', 'Cons. Disc.').replace('Consumer ', 'Cons. '), values: [s.thisWeek, s.lastWeek] }))}
              seriesNames={['This week', 'Last week']}
              axisLabel="Average return (%)"
              format={pct}
            />
          ) : (
            <EmptyState title="Not enough price history">Weekly returns need three weeks of daily closes.</EmptyState>
          )}
          <div className="data-time">
            {data.weekly.weekEnding ? `Weeks ending ${formatDate(data.weekly.weekEnding)} and ${formatDate(data.weekly.previousWeekEnding)} · equal-weighted average of members` : 'No weekly data yet'}
          </div>
        </section>
      </div>
      <div className="span-6">
        <section className="card" aria-label="Recent activity">
          <h3 className="card-title">Recent activity: watchlist filings</h3>
          {data.recentFilings.length ? (
            <ul className="activity">
              {data.recentFilings.map((f) => (
                <li key={f.accn}>
                  <span className="form-tag num">{f.form}</span>
                  <span className="activity-main">
                    <a className="num ticker" href={`#/research/${f.ticker}`}>{f.ticker}</a> <span className="muted">{f.description}</span>
                  </span>
                  <SourceChip source="EDGAR" filed={f.filed} href={f.url} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No filings to show">
              {data.watchlist.count ? (data.providers.edgar ? 'Filings for your watchlist load in the background.' : 'Connect SEC EDGAR to see filings.') : 'Add companies to your watchlist to follow their filings.'}
            </EmptyState>
          )}
          <div className="data-time">SEC EDGAR · each link opens the filing</div>
        </section>
      </div>

      <footer className="span-12 feature-strip">
        <span>US stocks only: NYSE and Nasdaq</span>
        <span>{quoteSource?.includes('IEX') ? 'Real-time prices from the IEX exchange only' : 'Delayed or end-of-day market data'}</span>
        <span>Every figure shows its source and time</span>
        <span>Formulas and inputs shown on hover</span>
        <span>AI reviews labelled, with evidence dates</span>
        {market?.holiday && <span>Today: {market.holiday} (market closed)</span>}
      </footer>
    </div>
  );
}

