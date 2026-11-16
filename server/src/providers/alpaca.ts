import type { Bar } from '@ust/shared';
import { secrets } from '../config';
import { fetchJson, ProviderError } from './http';

/**
 * Alpaca market data (free plan, used with paper-trading keys).
 * - Snapshots: IEX feed only on the free plan. IEX is real-time but covers one exchange,
 *   so quotes are labelled "Alpaca (IEX)" and never as consolidated real-time.
 * - Daily bars: consolidated (SIP) history, split-adjusted; falls back to IEX if SIP is refused.
 */
const BASE = 'https://data.alpaca.markets/v2';
export const ALPACA_QUOTE_SOURCE = 'Alpaca (IEX)';

const headers = () => {
  const id = secrets.alpacaKeyId();
  const secret = secrets.alpacaSecret();
  if (!id || !secret) throw new ProviderError('alpaca', 'API keys are not configured');
  return { 'APCA-API-KEY-ID': id, 'APCA-API-SECRET-KEY': secret };
};

interface RawBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface RawSnapshot {
  latestTrade?: { t: string; p: number } | null;
  dailyBar?: RawBar | null;
  prevDailyBar?: RawBar | null;
}

export interface ProviderQuote {
  ticker: string;
  price: number;
  prevClose: number | null;
  asOf: string;
  source: string;
  freshness: 'real-time' | 'delayed';
  delayMinutes?: number;
}

export async function snapshots(tickers: string[]): Promise<ProviderQuote[]> {
  const out: ProviderQuote[] = [];
  for (let i = 0; i < tickers.length; i += 100) {
    const batch = tickers.slice(i, i + 100);
    const url = `${BASE}/stocks/snapshots?feed=iex&symbols=${encodeURIComponent(batch.join(','))}`;
    const data = await fetchJson<Record<string, RawSnapshot | null>>(url, {
      provider: 'alpaca',
      logPath: `/v2/stocks/snapshots (${batch.length} symbols)`,
      headers: headers(),
    });
    for (const [ticker, s] of Object.entries(data)) {
      const trade = s?.latestTrade;
      if (!trade || !(trade.p > 0)) continue;
      out.push({
        ticker,
        price: trade.p,
        prevClose: s?.prevDailyBar?.c ?? null,
        asOf: trade.t,
        source: ALPACA_QUOTE_SOURCE,
        freshness: 'real-time',
      });
    }
  }
  return out;
}

async function barsPage(tickers: string[], start: string, end: string, feed: 'sip' | 'iex', pageToken?: string) {
  const q = new URLSearchParams({
    symbols: tickers.join(','),
    timeframe: '1Day',
    start,
    end,
    limit: '10000',
    adjustment: 'split',
    feed,
  });
  if (pageToken) q.set('page_token', pageToken);
  return fetchJson<{ bars: Record<string, RawBar[]> | null; next_page_token: string | null }>(`${BASE}/stocks/bars?${q}`, {
    provider: 'alpaca',
    logPath: `/v2/stocks/bars ${feed} (${tickers.length} symbols from ${start})`,
    headers: headers(),
    timeoutMs: 30_000,
  });
}

/** Daily bars for many tickers between two dates (inclusive). Returns the source label used. */
export async function dailyBars(tickers: string[], start: string, end: string): Promise<{ bars: Map<string, Bar[]>; source: string }> {
  const result = new Map<string, Bar[]>();
  let feed: 'sip' | 'iex' = 'sip';
  for (let i = 0; i < tickers.length; i += 50) {
    const batch = tickers.slice(i, i + 50);
    let token: string | undefined;
    for (;;) {
      let page;
      try {
        page = await barsPage(batch, start, end, feed, token);
      } catch (e) {
        // Free plans can be refused recent SIP data; IEX is always allowed.
        if (feed === 'sip' && e instanceof ProviderError && (e.status === 403 || e.status === 422)) {
          feed = 'iex';
          continue;
        }
        throw e;
      }
      for (const [t, rows] of Object.entries(page.bars ?? {})) {
        const list = result.get(t) ?? [];
        for (const b of rows) list.push({ date: b.t.slice(0, 10), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v });
        result.set(t, list);
      }
      token = page.next_page_token ?? undefined;
      if (!token) break;
    }
  }
  return { bars: result, source: feed === 'sip' ? 'Alpaca (consolidated, split-adjusted)' : 'Alpaca (IEX, split-adjusted)' };
}
