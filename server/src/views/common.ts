import type { MarketRow, QuoteView } from '@ust/shared';
import { getDb } from '../db';
import { recentCloses } from '../bars/service';
import { sma } from '../calculations/engine';
import { getQuotes } from '../quotes/service';

export interface Sp500Row {
  ticker: string;
  name: string;
  sector: string;
  cik: string;
}

export const sp500Rows = () =>
  getDb().prepare('SELECT ticker, name, sector, cik FROM companies WHERE in_sp500 = 1 ORDER BY ticker').all() as unknown as Sp500Row[];

export const watchlistTickers = (userId: number) =>
  (getDb().prepare('SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at').all(userId) as { ticker: string }[]).map((r) => r.ticker);

/** Every ticker any user watches; the background refresh keeps these current. */
export const allWatchedTickers = () => (getDb().prepare('SELECT DISTINCT ticker FROM watchlist').all() as { ticker: string }[]).map((r) => r.ticker);

export const emptyQuote = (ticker: string): QuoteView => ({ ticker, price: null, prevClose: null, changePct: null, asOf: null, source: null, freshness: null });

/** Whether each ticker's last stored close is above its own 50-day average; null with fewer than 50 closes. */
export function aboveMa50(tickers: string[]): Map<string, boolean | null> {
  const closes = recentCloses(tickers, 50);
  const out = new Map<string, boolean | null>();
  for (const t of tickers) {
    const c = closes.get(t) ?? [];
    if (c.length < 50) {
      out.set(t, null);
      continue;
    }
    const avg = sma(c.map((x) => x.close), 50).at(-1);
    out.set(t, avg == null ? null : c.at(-1)!.close > avg);
  }
  return out;
}

export function marketRows(items: { ticker: string; name: string; sector: string | null; kind: 'Stock' | 'ETF' }[], trendDays = 10): MarketRow[] {
  const tickers = items.map((i) => i.ticker);
  const quotes = getQuotes(tickers);
  const closes = recentCloses(tickers, trendDays);
  return items.map((i) => ({
    ...i,
    quote: quotes.get(i.ticker) ?? emptyQuote(i.ticker),
    trend: (closes.get(i.ticker) ?? []).map((c) => c.close),
  }));
}

export const latestAsOf = (quotes: Iterable<QuoteView>) => {
  let max: string | null = null;
  for (const q of quotes) if (q.asOf && (!max || q.asOf > max)) max = q.asOf;
  return max;
};
