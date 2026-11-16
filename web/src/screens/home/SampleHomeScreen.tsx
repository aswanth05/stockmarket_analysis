import { useState } from 'react';
import { AIReviewBox } from '../../components/AIReviewBox';
import { ChangeValue } from '../../components/ChangeValue';
import { ChartPanel, type Range } from '../../components/ChartPanel';
import { DataTable, type Column } from '../../components/DataTable';
import { SourceChip } from '../../components/SourceChip';
import { Sparkline } from '../../components/Sparkline';
import { SummaryCard } from '../../components/SummaryCard';
import { BreadthGauge } from '../../components/charts/BreadthGauge';
import { CandleChart } from '../../components/charts/CandleChart';
import { DonutChart } from '../../components/charts/DonutChart';
import { GroupedBars } from '../../components/charts/GroupedBars';
import { LineChart } from '../../components/charts/LineChart';
import { formatChangePct, formatEt, formatPrice } from '../../format';
import {
  ABOVE_50DMA_PCT,
  AI_REVIEW,
  BREADTH,
  BREADTH_TREND,
  INDEX_PROXIES,
  PRICE_CHART,
  RECENT_FILINGS,
  SAMPLE_AS_OF,
  SAMPLE_SOURCE,
  SECTOR_WEIGHTS,
  TOP_MARKETS,
  WATCHLIST,
  WEEKLY_SECTOR_RETURNS,
  edgarCompanyUrl,
  type MarketRow,
} from './sampleData';

const RANGE_DAYS: Partial<Record<Range, number>> = { '1W': 5, '1M': 21, '3M': 63, '1Y': 252 };
const NO_INTRADAY = 'intraday data is not connected yet';
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const dataTime = `Sample data · last point ${formatEt(SAMPLE_AS_OF)}`;

const MARKET_COLUMNS: Column<MarketRow>[] = [
  { key: 'ticker', header: 'Ticker', sortValue: (r) => r.ticker, render: (r) => <span className="num ticker">{r.ticker}</span> },
  { key: 'name', header: 'Name', render: (r) => <span className="cell-name">{r.name}{r.kind === 'ETF' && <span className="tag">ETF</span>}</span> },
  { key: 'price', header: 'Last', numeric: true, sortValue: (r) => r.price, render: (r) => formatPrice(r.price) },
  { key: 'chg', header: 'Change', numeric: true, sortValue: (r) => r.changePct, render: (r) => <ChangeValue pct={r.changePct} /> },
  {
    key: 'trend',
    header: '10-day',
    render: (r) =>
      r.trend.length > 1 ? (
        <Sparkline values={r.trend} label={`${r.ticker} 10-day trend, ${formatChangePct(r.changePct).spoken}`} width={80} height={24} />
      ) : (
        <span className="muted">—</span>
      ),
  },
];

export function SampleHomeScreen() {
  const [proxy, setProxy] = useState<(typeof INDEX_PROXIES)[number]['ticker']>('SPY');
  const [range, setRange] = useState<Range>('3M');
  const series = INDEX_PROXIES.find((p) => p.ticker === proxy)!;
  const points = series.points.slice(-(RANGE_DAYS[range] ?? 63));
  const first = points[0]!.value;
  const last = points[points.length - 1]!.value;
  const rangeChange = ((last - first) / first) * 100;

  const spy = INDEX_PROXIES[0].points;
  const spyLast = spy[spy.length - 1]!.value;
  const spyPrev = spy[spy.length - 2]!.value;

  const candleWindow = 120;
  const candleStart = PRICE_CHART.candles.length - candleWindow;

  return (
    <div className="home-grid">
      <div className="span-12 sample-banner" role="note">
        <strong>Layout preview.</strong> Every number on this page is sample data, not real market prices. Real data arrives in steps 31–33.
      </div>

      {/* Row 1: summary cards */}
      <div className="span-3">
        <SummaryCard
          title="S&P 500 (SPY proxy)"
          value={formatPrice(spyLast)}
          changePct={Math.round(((spyLast - spyPrev) / spyPrev) * 10000) / 100}
          sparkline={spy.slice(-20).map((p) => p.value)}
          asOf={SAMPLE_AS_OF}
          source={SAMPLE_SOURCE}
        />
      </div>
      <div className="span-3">
        <SummaryCard
          title="Market breadth"
          value={`${BREADTH.advancing}▲ ${BREADTH.declining}▼`}
          sparkline={BREADTH_TREND}
          asOf={SAMPLE_AS_OF}
          source={`${SAMPLE_SOURCE} · ${BREADTH.listSize} stocks in saved S&P 500 list`}
        />
      </div>
      <div className="span-3">
        <SummaryCard
          title="Watchlist: new filings or events"
          value={`${WATCHLIST.withNewFiling} of ${WATCHLIST.count}`}
          asOf={SAMPLE_AS_OF}
          source={`${SAMPLE_SOURCE} · last 7 days`}
        />
      </div>
      <div className="span-3">
        <SummaryCard title="Watchlist companies" value={String(WATCHLIST.count)} asOf={SAMPLE_AS_OF} source={SAMPLE_SOURCE} />
      </div>

      {/* Row 2: index chart + sector donut */}
      <div className="span-8">
        <ChartPanel
          title="Index ETF proxies"
          range={range}
          onRangeChange={setRange}
          disabledRanges={{ '1H': NO_INTRADAY, '1D': NO_INTRADAY }}
          dataTimeLabel={`${dataTime} · ETFs shown as proxies for the indexes`}
          summary={`${series.label} proxy ${proxy}: ${formatChangePct(rangeChange).spoken} over ${range}, ending at ${formatPrice(last)}.`}
        >
          <div className="proxy-row">
            <div className="tabs" role="group" aria-label="Index proxy">
              {INDEX_PROXIES.map((p) => (
                <button key={p.ticker} type="button" className="tab" aria-pressed={p.ticker === proxy} onClick={() => setProxy(p.ticker)}>
                  {p.label} <span className="num">({p.ticker})</span>
                </button>
              ))}
            </div>
            <span className="tag">ETF proxy</span>
            <span className="proxy-figure">
              <span className="num">{formatPrice(last)}</span> <ChangeValue pct={Math.round(rangeChange * 100) / 100} />
              <span className="muted"> over {range}</span>
            </span>
          </div>
          <LineChart points={points} format={(v) => `$${v.toFixed(0)}`} label={`${series.label} proxy ${proxy} price over ${range}`} />
        </ChartPanel>
      </div>
      <div className="span-4">
        <section className="card" aria-label="Sector breakdown">
          <h3 className="card-title">Sector breakdown</h3>
          <p className="card-sub">Saved S&P 500 list, by weight</p>
          <DonutChart
            slices={SECTOR_WEIGHTS.map((s) => ({ label: s.sector, value: s.weight }))}
            lastIsOther
            centerLabel="sectors"
            format={(v) => `${v.toFixed(1)}%`}
          />
          <div className="data-time">As of {formatEt(SAMPLE_AS_OF)} · {SAMPLE_SOURCE}</div>
        </section>
      </div>

      {/* Row 3: breadth gauge + top markets */}
      <div className="span-4">
        <section className="card" aria-label="Market breadth gauge">
          <h3 className="card-title">Market breadth</h3>
          <p className="card-sub">Our own measure, not a third-party sentiment index</p>
          <BreadthGauge pct={ABOVE_50DMA_PCT} definition="Share of saved S&P 500 stocks closing above their 50-day average" />
          <div className="data-time">As of {formatEt(SAMPLE_AS_OF)} · {SAMPLE_SOURCE}</div>
        </section>
      </div>
      <div className="span-8">
        <section className="card" aria-label="Top markets">
          <h3 className="card-title">Top markets</h3>
          <div className="table-scroll">
            <DataTable caption="US stocks and ETFs, sample prices" columns={MARKET_COLUMNS} rows={TOP_MARKETS} rowKey={(r) => r.ticker} />
          </div>
          <div className="data-time">As of {formatEt(SAMPLE_AS_OF)} · {SAMPLE_SOURCE} · a dash means no data, never zero</div>
        </section>
      </div>

      {/* Row 4: price chart + AI review */}
      <div className="span-8">
        <section className="card" aria-label="Daily price chart">
          <div className="card-head">
            <h3 className="card-title">Daily price chart</h3>
            <label className="select">
              <span className="visually-hidden">Stock</span>
              <select defaultValue={PRICE_CHART.ticker}>
                <option value="AAPL">AAPL · Apple Inc.</option>
              </select>
            </label>
          </div>
          <CandleChart
            candles={PRICE_CHART.candles.slice(candleStart)}
            ma50={PRICE_CHART.ma50.slice(candleStart)}
            ma200={PRICE_CHART.ma200.slice(candleStart)}
            label={`${PRICE_CHART.ticker} daily candles for the last ${candleWindow} trading days, with 50-day and 200-day averages`}
          />
          <div className="data-time">End-of-day {dataTime}</div>
        </section>
      </div>
      <div className="span-4">
        <AIReviewBox
          evidenceDate={AI_REVIEW.evidenceDate}
          sourceCount={AI_REVIEW.sourceCount}
          status="draft"
          score={AI_REVIEW.score}
          method={AI_REVIEW.method}
          summary={`${AI_REVIEW.ticker}: ${AI_REVIEW.summary}`}
        />
      </div>

      {/* Row 5: weekly comparison + recent activity */}
      <div className="span-6">
        <section className="card" aria-label="Weekly comparison">
          <h3 className="card-title">Weekly comparison: sector returns</h3>
          <GroupedBars
            groups={WEEKLY_SECTOR_RETURNS.map((s) => ({ label: s.sector, values: [s.thisWeek, s.lastWeek] }))}
            seriesNames={['This week', 'Last week']}
            axisLabel="Return (%)"
            format={pct}
          />
          <div className="data-time">Weeks ending Nov 13 and Nov 6 · {SAMPLE_SOURCE}</div>
        </section>
      </div>
      <div className="span-6">
        <section className="card" aria-label="Recent activity">
          <h3 className="card-title">Recent activity: watchlist filings</h3>
          <ul className="activity">
            {RECENT_FILINGS.map((f) => (
              <li key={`${f.ticker}-${f.form}-${f.filed}`}>
                <span className="form-tag num">{f.form}</span>
                <span className="activity-main">
                  <span className="num ticker">{f.ticker}</span> <span className="muted">{f.title}</span>
                </span>
                <SourceChip source="EDGAR" filed={f.filed} href={edgarCompanyUrl(f.ticker)} />
              </li>
            ))}
          </ul>
          <div className="data-time">{SAMPLE_SOURCE} · links open the company’s real EDGAR filing list</div>
        </section>
      </div>

      {/* Footer strip: only claims the app can support today */}
      <footer className="span-12 feature-strip">
        <span>US stocks only: NYSE and Nasdaq</span>
        <span>Delayed market data (planned: EODHD, 15–20 min)</span>
        <span>Every figure shows its source and time</span>
        <span>Formulas and inputs shown on hover</span>
        <span>AI reviews labelled, with evidence dates</span>
      </footer>
    </div>
  );
}
