import type { ReactNode } from 'react';

export type Range = '1H' | '1D' | '1W' | '1M' | '3M' | '1Y';
export const RANGES: Range[] = ['1H', '1D', '1W', '1M', '3M', '1Y'];

interface Props {
  title: string;
  range: Range;
  onRangeChange: (r: Range) => void;
  /** Ranges that cannot be shown, with the reason (e.g. no intraday data). */
  disabledRanges?: Partial<Record<Range, string>>;
  /** e.g. "Delayed 15 min · last point Nov 14, 4:00 PM ET" */
  dataTimeLabel: string;
  /** Text summary of the chart for screen readers. */
  summary: string;
  children: ReactNode;
}

export function ChartPanel(props: Props) {
  const { title, range, onRangeChange, disabledRanges = {}, dataTimeLabel, summary, children } = props;
  const reasons = Object.entries(disabledRanges);
  return (
    <section className="card" aria-label={title}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="card-title">{title}</h3>
        <div className="tabs" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className="tab"
              aria-pressed={r === range}
              disabled={r in disabledRanges}
              title={disabledRanges[r]}
              onClick={() => onRangeChange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>{children}</div>
      <p className="visually-hidden">{summary}</p>
      <div className="data-time">{dataTimeLabel}</div>
      {reasons.map(([r, why]) => (
        <div key={r} className="data-time">
          {r} unavailable: {why}
        </div>
      ))}
    </section>
  );
}
