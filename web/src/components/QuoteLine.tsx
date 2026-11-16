import type { MarketStatus, QuoteView } from '@ust/shared';
import { formatEt, formatPrice } from '../format';
import { ChangeValue } from './ChangeValue';
import { FreshnessBadge } from './FreshnessBadge';

interface Props {
  quote: QuoteView;
  market?: MarketStatus;
  size?: 'lg' | 'md';
}

/**
 * Price, change, freshness and time for one quote. When the market is closed the price is
 * labelled as the last trade with its date, so it never looks live (UI_DESIGN §6).
 */
export function QuoteLine({ quote, market, size = 'md' }: Props) {
  if (quote.price == null || !quote.asOf) {
    return <span className="muted">No price stored yet{quote.lastError ? ` (last attempt failed: ${quote.lastError})` : ''}</span>;
  }
  return (
    <span className="quote-line">
      <span className="num" style={{ fontSize: size === 'lg' ? 'var(--text-xl)' : undefined, fontWeight: 600 }}>
        {formatPrice(quote.price)}
      </span>{' '}
      <ChangeValue pct={quote.changePct} />{' '}
      {quote.freshness && <FreshnessBadge freshness={quote.freshness} asOf={quote.asOf} delayMinutes={quote.delayMinutes} />}
      <span className="data-time" style={{ display: 'block' }}>
        {market === 'closed' ? 'Market closed · last trade ' : 'As of '}
        {formatEt(quote.asOf)} · {quote.source}
      </span>
    </span>
  );
}
