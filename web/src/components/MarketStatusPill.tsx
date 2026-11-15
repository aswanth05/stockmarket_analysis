import type { MarketStatus } from '@ust/shared';

const LABELS: Record<MarketStatus, string> = {
  open: 'Market open',
  closed: 'Market closed',
  'pre-market': 'Pre-market',
  'after-hours': 'After-hours',
};

const COLORS: Record<MarketStatus, string> = {
  open: 'var(--color-gain)',
  closed: 'var(--color-text-muted)',
  'pre-market': 'var(--color-secondary)',
  'after-hours': 'var(--color-secondary)',
};

/** Shows the session status and the current Eastern Time. Status logic arrives in step 29. */
export function MarketStatusPill({ status, etTime }: { status: MarketStatus; etTime: string }) {
  return (
    <span className="pill" style={{ color: COLORS[status] }} role="status">
      <span className="pill-dot" aria-hidden="true" />
      {LABELS[status]}
      <span className="num muted"> · {etTime} ET</span>
    </span>
  );
}
