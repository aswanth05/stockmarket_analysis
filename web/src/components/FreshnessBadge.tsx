import type { Freshness } from '@ust/shared';
import { formatEt } from '../format';
import { useMarket } from '../layout/MarketContext';

interface Props {
  freshness: Freshness;
  /** Time of the data itself. Required so a stale badge always shows its time. */
  asOf: string;
  delayMinutes?: number;
}

const COLORS: Record<Freshness, string> = {
  'real-time': 'var(--color-gain)',
  delayed: 'var(--color-secondary)',
  stale: 'var(--color-warn)',
};

export function FreshnessBadge({ freshness, asOf, delayMinutes }: Props) {
  const market = useMarket();
  // With the market closed, a price is the last trade, never live (UI_DESIGN §6).
  if (market?.status === 'closed' && freshness !== 'stale') {
    return (
      <span className="pill muted" title={`Last trade ${formatEt(asOf)}`}>
        <span className="pill-dot" aria-hidden="true" />
        Closed · last trade
      </span>
    );
  }
  const label =
    freshness === 'real-time'
      ? 'Real-time'
      : freshness === 'delayed'
        ? `Delayed${delayMinutes ? ` ${delayMinutes} min` : ''}`
        : 'Stale';
  return (
    <span className="pill" style={{ color: COLORS[freshness] }} title={`Data as of ${formatEt(asOf)}`}>
      <span className="pill-dot" aria-hidden="true" />
      {label}
      {freshness === 'stale' && <span className="num"> · last {formatEt(asOf)}</span>}
    </span>
  );
}
