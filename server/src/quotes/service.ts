import type { QuoteView } from '@ust/shared';
import { pctChange } from '../calculations/engine';
import { providersConfigured } from '../config';
import { getDb, nowIso } from '../db';
import { marketStatus } from '../market/calendar';
import { snapshots, type ProviderQuote } from '../providers/alpaca';
import { delayedQuote } from '../providers/eodhd';

/** While the market is open, a quote older than this (beyond its stated delay) is marked stale. */
const STALE_AFTER_MIN = 15;

interface Row {
  ticker: string;
  price: number | null;
  prev_close: number | null;
  as_of: string | null;
  source: string | null;
  freshness: 'real-time' | 'delayed' | null;
  delay_minutes: number | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

export function getQuotes(tickers: string[], now = new Date()): Map<string, QuoteView> {
  const out = new Map<string, QuoteView>();
  if (!tickers.length) return out;
  const rows = getDb()
    .prepare(
      `SELECT t.value AS ticker, q.price, q.prev_close, q.as_of, q.source, q.freshness, q.delay_minutes,
              r.last_attempt_at, r.last_success_at, r.last_error
       FROM json_each(?) t LEFT JOIN quotes q ON q.ticker = t.value LEFT JOIN quote_refresh r ON r.ticker = t.value`,
    )
    .all(JSON.stringify(tickers)) as unknown as Row[];
  const open = marketStatus(now).status === 'open';
  for (const r of rows) out.set(r.ticker, toView(r, open, now));
  return out;
}

export function toView(r: Row, marketOpen: boolean, now: Date): QuoteView {
  if (r.price == null || r.as_of == null) {
    return { ticker: r.ticker, price: null, prevClose: null, changePct: null, asOf: null, source: null, freshness: null, lastError: r.last_error };
  }
  // A successful refresh clears last_error, so any stored error means the latest attempt failed.
  const failedSinceSuccess = Boolean(r.last_error);
  const ageMin = (now.getTime() - Date.parse(r.as_of)) / 60_000;
  const tooOld = marketOpen && ageMin > (r.delay_minutes ?? 0) + STALE_AFTER_MIN;
  return {
    ticker: r.ticker,
    price: r.price,
    prevClose: r.prev_close,
    changePct: pctChange(r.price, r.prev_close),
    asOf: r.as_of,
    source: r.source,
    freshness: failedSinceSuccess || tooOld ? 'stale' : r.freshness,
    delayMinutes: r.delay_minutes ?? undefined,
    lastError: failedSinceSuccess ? r.last_error : null,
  };
}

function save(quotes: ProviderQuote[]) {
  const db = getDb();
  const at = nowIso();
  const up = db.prepare(`
    INSERT INTO quotes (ticker, price, prev_close, as_of, source, freshness, delay_minutes, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ticker) DO UPDATE SET price = excluded.price, prev_close = excluded.prev_close, as_of = excluded.as_of,
      source = excluded.source, freshness = excluded.freshness, delay_minutes = excluded.delay_minutes, fetched_at = excluded.fetched_at
    WHERE excluded.as_of >= quotes.as_of`);
  const ok = db.prepare(`
    INSERT INTO quote_refresh (ticker, last_attempt_at, last_success_at, last_error) VALUES (?, ?, ?, NULL)
    ON CONFLICT(ticker) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_success_at = excluded.last_success_at, last_error = NULL`);
  db.exec('BEGIN');
  for (const q of quotes) {
    up.run(q.ticker, q.price, q.prevClose, q.asOf, q.source, q.freshness, q.delayMinutes ?? null, at);
    ok.run(q.ticker, at, at);
  }
  db.exec('COMMIT');
}

/** Keeps the stored value; only records that the refresh failed (CLAUDE.md: keep last value, mark stale). */
export function markFailed(tickers: string[], error: string) {
  const db = getDb();
  const at = nowIso();
  const st = db.prepare(`
    INSERT INTO quote_refresh (ticker, last_attempt_at, last_success_at, last_error) VALUES (?, ?, NULL, ?)
    ON CONFLICT(ticker) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_error = excluded.last_error`);
  db.exec('BEGIN');
  for (const t of tickers) st.run(t, at, error.slice(0, 200));
  db.exec('COMMIT');
}

export const saveQuotesForTests = save;

/**
 * Refresh quotes from the configured providers. Alpaca (batched) first; EODHD (one call per ticker,
 * tight free-plan limits) only as a fallback for small requests.
 */
export async function refreshQuotes(tickers: string[]): Promise<{ updated: number; failed: number }> {
  const p = providersConfigured();
  if (!tickers.length || (!p.alpaca && !p.eodhd)) return { updated: 0, failed: 0 };
  let pending = [...tickers];
  let updated = 0;
  let lastErr = 'no data returned by provider';
  if (p.alpaca) {
    try {
      const got = await snapshots(pending);
      save(got);
      updated += got.length;
      const seen = new Set(got.map((q) => q.ticker));
      pending = pending.filter((t) => !seen.has(t));
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  if (pending.length && p.eodhd && pending.length <= 3) {
    for (const t of [...pending]) {
      try {
        const q = await delayedQuote(t);
        if (q) {
          save([q]);
          updated++;
          pending = pending.filter((x) => x !== t);
        }
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
  }
  if (pending.length) markFailed(pending, lastErr);
  return { updated, failed: pending.length };
}
