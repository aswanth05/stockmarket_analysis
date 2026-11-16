import { useState } from 'react';
import type { BarsResponse } from '@ust/shared';
import { useApi } from '../../api/useApi';
import { CandleChart } from '../../components/charts/CandleChart';
import { FormulaTooltip } from '../../components/FormulaTooltip';
import { ServerTickerSearch } from '../../components/ServerTickerSearch';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/states/States';
import { formatDate, formatPrice, formatSignedPct, MISSING } from '../../format';

/** Daily candles with volume and 50/200-day averages (step 36). Averages are calculated on the server. */
export function DailyChartCard({ ticker, pickable, window = 120 }: { ticker: string; pickable?: boolean; window?: number }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const t = chosen ?? ticker;
  const { data, error, loading, reload } = useApi<BarsResponse>(`/bars/${encodeURIComponent(t)}?days=${window}`);

  return (
    <section className="card" aria-label="Daily price chart">
      <div className="card-head">
        <h3 className="card-title">
          Daily price chart · <a className="num ticker" href={`#/research/${t}`}>{t}</a>
        </h3>
        {pickable && (
          <div style={{ width: 240 }}>
            <ServerTickerSearch onSelect={(o) => setChosen(o.ticker)} label="Change stock" />
          </div>
        )}
      </div>
      {loading && !data ? (
        <LoadingSkeleton lines={5} label="Loading chart" />
      ) : !data ? (
        <ErrorState what="The chart could not be loaded." next={error ?? ''} onRetry={reload} />
      ) : data.bars.length < 2 ? (
        <EmptyState title={`No daily prices stored for ${t}`}>Daily history loads once market data is connected.</EmptyState>
      ) : (
        <>
          <CandleChart candles={data.bars} ma50={data.ma50} ma200={data.ma200} label={`${t} daily candles for ${data.bars.length} trading days with 50-day and 200-day averages`} />
          <div className="data-time">
            End-of-day · last bar {formatDate(data.lastBarDate)} · {data.source}
          </div>
        </>
      )}
    </section>
  );
}

const STAT_DEFS = [
  { key: 'change20dPct', label: '20-day change', formula: '(Close today − Close 20 trading days ago) ÷ Close 20 days ago', pct: true },
  { key: 'distFromMa50Pct', label: 'Distance from 50-day average', formula: '(Close − 50-day average) ÷ 50-day average', pct: true },
  { key: 'distFromMa200Pct', label: 'Distance from 200-day average', formula: '(Close − 200-day average) ÷ 200-day average', pct: true },
  { key: 'high52w', label: '52-week high', formula: 'Highest daily high over the last 252 trading days', pct: false },
  { key: 'low52w', label: '52-week low', formula: 'Lowest daily low over the last 252 trading days', pct: false },
  { key: 'volumeVsAvg20', label: 'Volume vs 20-day average', formula: 'Latest volume ÷ average volume of the previous 20 days', pct: false },
] as const;

/** Swing Trading statistics, each with its formula, period and source. */
export function SwingStats({ data }: { data: BarsResponse }) {
  const s = data.stats;
  const period = `Daily closes to ${formatDate(data.lastBarDate)}`;
  return (
    <div className="metric-grid">
      {STAT_DEFS.map((d) => {
        const v = s[d.key];
        const text = v == null ? MISSING : d.pct ? formatSignedPct(v) : d.key === 'volumeVsAvg20' ? `${v.toFixed(2)}×` : formatPrice(v);
        return (
          <div key={d.key} className="metric">
            <div className="metric-label">{d.label}</div>
            <FormulaTooltip formula={d.formula} inputs={[{ label: 'Last close', value: formatPrice(s.lastClose) }]} period={period} source={data.source ?? 'no source'}>
              {text}
            </FormulaTooltip>
            {v == null && <div className="data-time">Not enough price history</div>}
          </div>
        );
      })}
    </div>
  );
}
