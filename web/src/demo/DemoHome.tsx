import { useApi } from '../api/useApi';
import { DataTable, type Column } from '../components/DataTable';
import { SourceChip } from '../components/SourceChip';
import { SummaryCard } from '../components/SummaryCard';
import { DonutChart } from '../components/charts/DonutChart';
import { GroupedBars } from '../components/charts/GroupedBars';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states/States';
import { formatDate, formatRatioPct } from '../format';
import type { DemoHomeResponse, DemoRankRow } from './demoApi';

const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`;
const shortSector = (s: string) =>
  s.replace('Information Technology', 'Info Tech').replace('Communication Services', 'Comm Svcs').replace('Consumer Discretionary', 'Cons. Disc.').replace('Consumer ', 'Cons. ');

const COLUMNS: Column<DemoRankRow>[] = [
  { key: 'ticker', header: 'Ticker', sortValue: (r) => r.ticker, render: (r) => <a className="num ticker" href={`#/research/${r.ticker}`}>{r.ticker}</a> },
  { key: 'name', header: 'Company', render: (r) => <>{r.name}<div className="data-time" style={{ marginTop: 0 }}>{shortSector(r.sector)}</div></> },
  { key: 'growth', header: 'Revenue growth', numeric: true, sortValue: (r) => r.revenueGrowth, render: (r) => formatRatioPct(r.revenueGrowth) },
  { key: 'margin', header: 'Net margin', numeric: true, sortValue: (r) => r.netMargin, render: (r) => formatRatioPct(r.netMargin) },
];

/** Home for the public demo: everything here comes from the real SEC EDGAR snapshot. */
export function DemoHome() {
  const { data, error, loading, reload } = useApi<DemoHomeResponse>('/demo-home');
  if (loading && !data) return <LoadingSkeleton lines={6} label="Loading Home" />;
  if (!data) return <ErrorState what="Home could not be loaded." next={error ?? ''} onRetry={reload} />;
  if (data.status !== 'ok') {
    return <EmptyState title="The SEC data snapshot is not available yet">It is rebuilt daily by the site’s GitHub workflow.</EmptyState>;
  }

  const asOf = data.generatedAt ?? '';
  const source = `SEC EDGAR · ${data.period}`;
  const footnote = `Revenue growth = (Revenue ${data.period?.split(' vs ')[0]} − Revenue ${data.period?.split(' vs ')[1]}) ÷ Revenue ${data.period?.split(' vs ')[1]}. Net margin = Net income ÷ Revenue. Calendar-year SEC XBRL data, snapshot of ${formatDate(asOf.slice(0, 10))}.`;

  return (
    <div className="home-grid">
      <div className="span-3">
        <SummaryCard title="Companies with SEC financials" value={`${data.withAnnual} of ${data.listSize}`} asOf={asOf} source="SEC EDGAR 10-K data" />
      </div>
      <div className="span-3">
        <SummaryCard title="Median revenue growth" value={formatRatioPct(data.medianGrowth)} asOf={asOf} source={`${source} · ${data.withGrowth} companies`} />
      </div>
      <div className="span-3">
        <SummaryCard title="Median net margin" value={formatRatioPct(data.medianMargin)} asOf={asOf} source={source} />
      </div>
      <div className="span-3">
        <SummaryCard title="Revenue growing vs shrinking" value={`${data.growing}▲ ${data.shrinking}▼`} asOf={asOf} source={source} />
      </div>

      <div className="span-8">
        <section className="card" aria-label="Sector business performance">
          <h3 className="card-title">Sector business performance</h3>
          <p className="card-sub">Median across S&P 500 companies in each sector, highest growth first</p>
          <GroupedBars
            groups={data.sectors.map((s) => ({
              label: shortSector(s.sector),
              values: [s.medianGrowth == null ? null : s.medianGrowth * 100, s.medianMargin == null ? null : s.medianMargin * 100],
            }))}
            seriesNames={['Revenue growth', 'Net margin']}
            axisLabel="Percent"
            format={pct}
          />
          <div className="data-time">{source} · open Sector Analysis for the full table</div>
        </section>
      </div>
      <div className="span-4">
        <section className="card" aria-label="Sector breakdown">
          <h3 className="card-title">Sector breakdown</h3>
          <p className="card-sub">Saved S&P 500 list, by number of companies</p>
          <DonutChart
            slices={[...data.sectors]
              .sort((a, b) => b.count - a.count)
              .slice(0, 6)
              .map((s) => ({ label: s.sector, value: s.count }))
              .concat([{ label: `Other ${data.sectors.length - 6} sectors`, value: [...data.sectors].sort((a, b) => b.count - a.count).slice(6).reduce((a, s) => a + s.count, 0) }])}
            lastIsOther
            centerLabel="sectors"
            format={(v) => `${v} cos.`}
          />
          <div className="data-time">Saved list · Wikipedia, List of S&P 500 companies</div>
        </section>
      </div>

      <div className="span-6">
        <section className="card" aria-label="Fastest revenue growth">
          <h3 className="card-title">Fastest revenue growth</h3>
          <p className="card-sub">Top 10 in the S&P 500. Click a ticker for the full financials.</p>
          <div className="table-scroll">
            <DataTable caption="Fastest revenue growth" columns={COLUMNS} rows={data.topGrowth} rowKey={(r) => r.ticker} />
          </div>
          <div className="data-time">{source}. Growth describes past results, not future prices.</div>
        </section>
      </div>
      <div className="span-6">
        <section className="card" aria-label="Highest net margin">
          <h3 className="card-title">Highest net margin</h3>
          <p className="card-sub">Top 10 in the S&P 500 by profit kept from each dollar of revenue</p>
          <div className="table-scroll">
            <DataTable caption="Highest net margin" columns={COLUMNS} rows={data.topMargin} rowKey={(r) => r.ticker} />
          </div>
          <div className="data-time">{source}. Very high margins can come from one-off gains; check the company’s filings.</div>
        </section>
      </div>

      <div className="span-12">
        <section className="card" aria-label="Recent activity">
          <h3 className="card-title">Recent filings: your watchlist ({data.watchlist.count} companies, {data.watchlist.withNewFiling} with a filing in the last 7 days)</h3>
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
            <EmptyState title="No filings to show">Add companies on the My Watchlist page to follow their filings.</EmptyState>
          )}
          <div className="data-time">SEC EDGAR · each link opens the filing on sec.gov</div>
        </section>
      </div>

      <footer className="span-12 feature-strip">
        <span>{footnote}</span>
      </footer>
    </div>
  );
}
