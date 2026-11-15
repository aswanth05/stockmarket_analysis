import type { ReactNode } from 'react';
import { formatEt, MISSING } from '../format';
import { ChangeValue } from './ChangeValue';
import { Sparkline } from './Sparkline';

interface Props {
  title: string;
  /** Pre-formatted value, or null when there is not enough data. */
  value: string | null;
  changePct?: number | null;
  sparkline?: number[];
  asOf: string;
  source: string;
  badge?: ReactNode;
}

export function SummaryCard({ title, value, changePct, sparkline, asOf, source, badge }: Props) {
  return (
    <section className="card" aria-label={title}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <h3 className="card-title">{title}</h3>
        {badge}
      </div>
      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div className="num" style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>
            {value ?? MISSING}
          </div>
          {value == null ? (
            <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>
              Not enough data
            </div>
          ) : (
            changePct !== undefined && <ChangeValue pct={changePct} />
          )}
        </div>
        {sparkline && <Sparkline values={sparkline} label={`${title} trend`} />}
      </div>
      <div className="data-time">
        As of {formatEt(asOf)} · {source}
      </div>
    </section>
  );
}
