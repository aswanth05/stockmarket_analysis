import type { Bar } from '@ust/shared';
import { secrets } from '../config';
import type { ProviderQuote } from './alpaca';
import { fetchJson, ProviderError } from './http';

/**
 * EODHD free plan: 15–20 minute delayed quotes and end-of-day history.
 * The free plan allows very few calls per day, so it is the fallback source, used one ticker at a time.
 */
const BASE = 'https://eodhd.com/api';
export const EODHD_DELAY_MINUTES = 15;

const token = () => {
  const t = secrets.eodhdToken();
  if (!t) throw new ProviderError('eodhd', 'API token is not configured');
  return t;
};

/** BRK.B → BRK-B.US */
const symbol = (ticker: string) => `${ticker.replace('.', '-')}.US`;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function delayedQuote(ticker: string): Promise<ProviderQuote | null> {
  const s = symbol(ticker);
  const data = await fetchJson<{ timestamp?: unknown; close?: unknown; previousClose?: unknown }>(
    `${BASE}/real-time/${encodeURIComponent(s)}?fmt=json&api_token=${encodeURIComponent(token())}`,
    { provider: 'eodhd', logPath: `/api/real-time/${s}` },
  );
  const price = num(data.close);
  const ts = num(data.timestamp);
  if (price == null || price <= 0 || ts == null) return null;
  return {
    ticker,
    price,
    prevClose: num(data.previousClose),
    asOf: new Date(ts * 1000).toISOString(),
    source: 'EODHD (delayed)',
    freshness: 'delayed',
    delayMinutes: EODHD_DELAY_MINUTES,
  };
}

export async function endOfDay(ticker: string, from: string): Promise<Bar[]> {
  const s = symbol(ticker);
  const rows = await fetchJson<{ date: string; open: number; high: number; low: number; close: number; volume: number }[]>(
    `${BASE}/eod/${encodeURIComponent(s)}?fmt=json&from=${from}&api_token=${encodeURIComponent(token())}`,
    { provider: 'eodhd', logPath: `/api/eod/${s} from ${from}` },
  );
  return rows
    .filter((r) => [r.open, r.high, r.low, r.close].every((v) => typeof v === 'number' && v > 0))
    .map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume ?? 0 }));
}

export const EODHD_BARS_SOURCE = 'EODHD (end-of-day, unadjusted)';
