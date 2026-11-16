import { useState } from 'react';
import type { AiReviewView, AnnualRow, BarsResponse, MetricView, ResearchResponse, SourceRef, WatchlistItem } from '@ust/shared';
import { apiDelete, apiPost } from '../../api/client';
import { useApi } from '../../api/useApi';
import { FormulaTooltip } from '../../components/FormulaTooltip';
import { QuoteLine } from '../../components/QuoteLine';
import { ServerTickerSearch } from '../../components/ServerTickerSearch';
import { SourceChip } from '../../components/SourceChip';
import { GroupedBars } from '../../components/charts/GroupedBars';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/states/States';
import { formatDate, formatRatioPct, formatUsdBig, MISSING } from '../../format';
import { DEMO } from '../../demo/mode';
import { useMarket } from '../../layout/MarketContext';
import { DailyChartCard, SwingStats } from './DailyChartCard';

const go = (t: string) => {
  window.location.hash = `#/research/${encodeURIComponent(t)}`;
};

export function ResearchScreen({ ticker }: { ticker?: string }) {
  if (!ticker) return <PickCompany />;
  return <Research key={ticker} ticker={ticker.toUpperCase()} />;
}

function PickCompany() {
  const { data } = useApi<{ items: WatchlistItem[] }>('/watchlist');
  return (
    <div className="stack">
      <section className="card">
        <h2 className="section-title">Research a company</h2>
        <p className="muted">Search NYSE and Nasdaq companies by ticker or name.</p>
        <div style={{ maxWidth: 420 }}>
          <ServerTickerSearch onSelect={(o) => go(o.ticker)} />
        </div>
      </section>
      {data && data.items.length > 0 && (
        <section className="card">
          <h3 className="card-title">From your watchlist</h3>
          <div className="chip-row">
            {data.items.map((i) => (
              <a key={i.ticker} className="pill" href={`#/research/${i.ticker}`}>
                <span className="num">{i.ticker}</span> {i.name}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Research({ ticker }: { ticker: string }) {
  const { data, error, loading, reload } = useApi<ResearchResponse>(`/research/${encodeURIComponent(ticker)}`, 60_000);
  const [tab, setTab] = useState<'long' | 'swing'>('long');

  if (loading && !data) return <LoadingSkeleton lines={8} label={`Loading ${ticker}`} />;
  if (!data) return <ErrorState what={`Research for ${ticker} could not be loaded.`} next={error ?? 'Try again.'} onRetry={reload} />;

  return (
    <div className="stack">
      <CompanyHeader data={data} />
      {error && <p className="form-error" role="alert">Latest refresh failed: {error}. Showing the last loaded data.</p>}
      <div className="tabs tabs-lg" role="tablist" aria-label="Research view">
        <button role="tab" type="button" className="tab" id="tab-long" aria-controls="panel-long" aria-selected={tab === 'long'} aria-pressed={tab === 'long'} onClick={() => setTab('long')}>
          Long Term
        </button>
        <button role="tab" type="button" className="tab" id="tab-swing" aria-controls="panel-swing" aria-selected={tab === 'swing'} aria-pressed={tab === 'swing'} onClick={() => setTab('swing')}>
          Swing Trading
        </button>
      </div>
      {tab === 'long' ? (
        <div role="tabpanel" id="panel-long" aria-labelledby="tab-long" className="stack">
          <LongTerm data={data} onReview={reload} />
        </div>
      ) : (
        <div role="tabpanel" id="panel-swing" aria-labelledby="tab-swing" className="stack">
          <Swing ticker={ticker} />
        </div>
      )}
      <Sources sources={data.sources} />
    </div>
  );
}

function CompanyHeader({ data }: { data: ResearchResponse }) {
  const c = data.company;
  const market = useMarket();
  const { data: wl, setData } = useApi<{ items: WatchlistItem[] }>('/watchlist');
  const watching = wl?.items.some((i) => i.ticker === c.ticker) ?? false;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = watching
        ? await apiDelete<{ items: WatchlistItem[] }>(`/watchlist/${encodeURIComponent(c.ticker)}`)
        : await apiPost<{ items: WatchlistItem[] }>('/watchlist', { ticker: c.ticker });
      setData(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card company-header" aria-label="Company">
      <div className="company-id">
        <h2 className="company-name">
          {c.name} <span className="num ticker muted">{c.ticker}</span>
        </h2>
        <div className="chip-row">
          <span className="pill">{c.exchange ?? 'Exchange not stored'}</span>
          {c.sector && <span className="pill">{c.sector}</span>}
          {c.subIndustry && <span className="pill muted">{c.subIndustry}</span>}
          {c.inSp500 && <span className="tag">S&P 500</span>}
        </div>
      </div>
      <div className="company-quote">
        <QuoteLine quote={data.quote} market={market?.status} size="lg" />
      </div>
      <div className="company-actions">
        <button type="button" className={watching ? 'btn btn-ghost' : 'btn'} onClick={toggle} disabled={busy || !wl}>
          {watching ? '★ In watchlist' : '☆ Add to watchlist'}
        </button>
        <div style={{ width: 220 }}>
          <ServerTickerSearch onSelect={(o) => go(o.ticker)} label="Another company" />
        </div>
        {msg && <p className="form-error" role="alert">{msg}</p>}
      </div>
    </section>
  );
}

function refText(ref?: SourceRef) {
  return ref ? `${ref.source}${ref.form ? `, ${ref.form}` : ''}${ref.accn ? `, filing ${ref.accn}` : ''}${ref.filed ? `, filed ${ref.filed}` : ''}` : 'no source';
}

function MetricCard({ m }: { m: MetricView }) {
  const text = m.value == null ? MISSING : m.unit === 'pct' ? formatRatioPct(m.value) : formatUsdBig(m.value);
  const src = m.inputs.find((i) => i.ref)?.ref;
  return (
    <div className="metric">
      <div className="metric-label">{m.name}</div>
      <FormulaTooltip
        formula={`${m.name} = ${m.formula}`}
        inputs={m.inputs.map((i) => ({ label: `${i.label} (${i.period ?? ''})`, value: i.unit === 'usd' ? formatUsdBig(i.value) : String(i.value ?? MISSING) }))}
        period={m.period}
        source={`${refText(src)} · definition ${m.version}`}
      >
        {text}
      </FormulaTooltip>
      {m.reason && <div className="data-time">{m.value == null ? 'Not calculated: ' : 'Note: '}{m.reason}</div>}
      <div className="data-time">{m.period}</div>
    </div>
  );
}

function AsReported({ value, label, end, from: r }: { value: number | null; label: string; end: string; from?: SourceRef }) {
  if (value == null) return <span className="muted">{MISSING}</span>;
  return (
    <FormulaTooltip formula={`${label}: as reported in the annual filing`} inputs={[{ label, value: formatUsdBig(value) }]} period={`FY ending ${end}`} source={refText(r)}>
      {formatUsdBig(value)}
    </FormulaTooltip>
  );
}

function LongTerm({ data, onReview }: { data: ResearchResponse; onReview: () => void }) {
  const years = [...data.annual].reverse();
  const f = data.factors;

  if (data.company.cik == null) {
    return <EmptyState title="No SEC filings for this security">ETFs and funds do not file 10-K reports. See the Swing Trading tab for price data.</EmptyState>;
  }

  return (
    <>
      {data.fundamentalsStatus !== 'loaded' && (
        <div className="notice" role="note">
          {data.fundamentalsStatus === 'not-configured' && (
            <>
              {DEMO ? (
                <>
                  <strong>SEC data has not been downloaded for this demo yet.</strong> The site owner adds the <code>SEC_EDGAR_USER_AGENT</code> secret in GitHub and re-runs the deploy.
                </>
              ) : (
                <>
                  <strong>SEC EDGAR is not connected.</strong> Add <code>SEC_EDGAR_USER_AGENT</code> (your name and email) to <code>server/.env</code> and restart the server to load filings.
                </>
              )}
            </>
          )}
          {data.fundamentalsStatus === 'error' && <>Financial data could not be loaded: {data.fundamentalsError}. The page will try again on the next refresh.</>}
          {data.fundamentalsStatus === 'not-found' && <>No annual (10-K) financial data was found for this company in SEC EDGAR.</>}
        </div>
      )}

      {data.metrics.length > 0 && (
        <section className="card" aria-label="Key figures">
          <h3 className="card-title">Key figures (hover or focus a number to see how it was calculated)</h3>
          <div className="metric-grid">
            {data.metrics.map((m) => (
              <MetricCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      )}

      {years.length > 0 && (
        <section className="card" aria-label="Financial history">
          <h3 className="card-title">Revenue and net income by fiscal year</h3>
          <GroupedBars
            groups={years.map((y) => ({ label: `FY ${y.end.slice(0, 4)}`, values: [y.revenue == null ? null : y.revenue / 1e9, y.netIncome == null ? null : y.netIncome / 1e9] }))}
            seriesNames={['Revenue', 'Net income']}
            axisLabel="US dollars, billions"
            format={(v) => `$${v.toFixed(0)}B`}
          />
          <AnnualTable rows={data.annual} />
          <div className="data-time">SEC EDGAR XBRL company facts, 10-K filings. Fiscal years are labelled by their real period end.</div>
        </section>
      )}

      {data.metrics.length > 0 && (
        <section className="card" aria-label="Factor scores">
          <div className="card-head">
            <h3 className="card-title">Factor scores</h3>
            <span className="pill" style={{ color: 'var(--color-warn)' }}>Experimental · not tested</span>
          </div>
          <table className="data-table">
            <caption className="visually-hidden">Factor scores with weights</caption>
            <thead>
              <tr>
                <th scope="col">Factor</th>
                <th scope="col" className="num">Weight</th>
                <th scope="col" className="num">Score</th>
                <th scope="col">How it is scored</th>
              </tr>
            </thead>
            <tbody>
              {f.scores.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="num">{Math.round(s.weight * 100)}%</td>
                  <td className="num">{s.score ?? MISSING}</td>
                  <td className="muted">{s.basis}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Total</th>
                <td />
                <td className="num"><strong>{f.total ?? MISSING}</strong></td>
                <td className="muted">{f.total == null ? 'Needs at least 3 factors with data' : 'Weighted average of factors with data, 0–100'}</td>
              </tr>
            </tbody>
          </table>
          <div className="data-time">{f.method}</div>
        </section>
      )}

      <section className="card" aria-label="Risks">
        <h3 className="card-title">Risks found in the figures</h3>
        {data.risks.length ? (
          <ul className="risk-list">
            {data.risks.map((r) => (
              <li key={r.id}>
                <span aria-hidden="true">⚠</span> {r.text} <span className="muted">Rule: {r.basis}.</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{data.metrics.length ? 'None of the app’s risk rules were triggered by the stored figures.' : 'No figures stored, so no rules could be checked.'}</p>
        )}
        <div className="data-time">Rule-based checks on stored filings. This is not a full risk assessment; read the company’s 10-K “Risk Factors” section.</div>
      </section>

      <AiReviewPanel ticker={data.company.ticker} review={data.aiReview} onDone={onReview} />

      {data.filings.length > 0 && (
        <section className="card" aria-label="Recent filings">
          <h3 className="card-title">Recent filings</h3>
          <ul className="activity">
            {data.filings.map((fl) => (
              <li key={fl.accn}>
                <span className="form-tag num">{fl.form}</span>
                <span className="activity-main muted">{fl.description}{fl.reportDate ? ` · period ${fl.reportDate}` : ''}</span>
                <SourceChip source="EDGAR" filed={fl.filed} href={fl.url} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function AnnualTable({ rows }: { rows: AnnualRow[] }) {
  return (
    <div className="table-scroll" style={{ marginTop: 'var(--space-4)' }}>
      <table className="data-table">
        <caption className="visually-hidden">Annual figures from 10-K filings</caption>
        <thead>
          <tr>
            <th scope="col">Fiscal year ending</th>
            <th scope="col" className="num">Revenue</th>
            <th scope="col" className="num">Net income</th>
            <th scope="col" className="num">Operating cash flow</th>
            <th scope="col" className="num">Capital spending</th>
            <th scope="col" className="num">Free cash flow</th>
            <th scope="col" className="num">Equity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.end}>
              <th scope="row" className="num">{r.end}</th>
              <td className="num"><AsReported value={r.revenue} label="Revenue" end={r.end} from={r.refs.revenue} /></td>
              <td className="num"><AsReported value={r.netIncome} label="Net income" end={r.end} from={r.refs.netIncome} /></td>
              <td className="num"><AsReported value={r.operatingCashFlow} label="Operating cash flow" end={r.end} from={r.refs.operatingCashFlow} /></td>
              <td className="num"><AsReported value={r.capex} label="Capital expenditures" end={r.end} from={r.refs.capex} /></td>
              <td className="num">
                {r.freeCashFlow == null ? (
                  <span className="muted">{MISSING}</span>
                ) : (
                  <FormulaTooltip
                    formula="Free cash flow = Operating cash flow − Capital expenditures"
                    inputs={[
                      { label: 'Operating cash flow', value: formatUsdBig(r.operatingCashFlow) },
                      { label: 'Capital expenditures', value: formatUsdBig(r.capex) },
                    ]}
                    period={`FY ending ${r.end}`}
                    source={refText(r.refs.operatingCashFlow)}
                  >
                    {formatUsdBig(r.freeCashFlow)}
                  </FormulaTooltip>
                )}
              </td>
              <td className="num"><AsReported value={r.equity} label="Shareholders’ equity" end={r.end} from={r.refs.equity} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiReviewPanel({ ticker, review, onDone }: { ticker: string; review: AiReviewView | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/research/${encodeURIComponent(ticker)}/ai-review`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card" aria-label="AI review">
      <div className="card-head">
        <h3 className="card-title">AI review</h3>
        <span className="pill" style={{ color: 'var(--color-secondary)' }}>AI-generated</span>
      </div>
      {review ? (
        <>
          <p>{review.summary}</p>
          {review.points.length > 0 && (
            <ul className="risk-list">
              {review.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <dl className="data-time review-meta">
            <div><dt>Evidence date</dt><dd className="num">{review.evidenceDate}</dd></div>
            <div><dt>Written</dt><dd>{formatDate(review.createdAt)}</dd></div>
            <div><dt>Model</dt><dd>{review.model}</dd></div>
            <div><dt>Status</dt><dd>{review.status}</dd></div>
            <div><dt>Sources</dt><dd className="num">{review.sources.length}</dd></div>
          </dl>
        </>
      ) : (
        <p className="muted">No AI review for this company yet.</p>
      )}
      <p className="data-time">Claude explains the stored figures and filings shown on this page. It does not calculate numbers or recommend trades.</p>
      <button type="button" className="btn btn-ghost" onClick={create} disabled={busy}>
        {busy ? 'Writing review…' : review ? 'Write a new review' : 'Write a review'}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

function Swing({ ticker }: { ticker: string }) {
  const { data } = useApi<BarsResponse>(`/bars/${encodeURIComponent(ticker)}?days=260`);
  return (
    <>
      <DailyChartCard ticker={ticker} window={260} />
      {data && data.bars.length > 1 && (
        <section className="card" aria-label="Price statistics">
          <h3 className="card-title">Price statistics</h3>
          <SwingStats data={data} />
          <div className="data-time">Calculated on the server from stored daily closes. Not a forecast.</div>
        </section>
      )}
    </>
  );
}

function Sources({ sources }: { sources: SourceRef[] }) {
  if (!sources.length) return null;
  return (
    <section className="card" aria-label="Sources">
      <h3 className="card-title">Sources</h3>
      <div className="chip-row">
        {sources.map((s, i) => (
          <SourceChip key={`${s.source}-${s.accn ?? i}`} source={s.accn ? `${s.source} (${s.accn})` : s.source} form={s.form} filed={s.filed?.slice(0, 10)} href={s.url} />
        ))}
      </div>
    </section>
  );
}
