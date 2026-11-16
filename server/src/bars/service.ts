import type { Bar, BarsResponse, SwingStats } from '@ust/shared';
import { mean, pctChange, sma } from '../calculations/engine';
import { providersConfigured } from '../config';
import { getDb } from '../db';
import { lastTradingDay } from '../market/calendar';
import { dailyBars } from '../providers/alpaca';
import { EODHD_BARS_SOURCE, endOfDay } from '../providers/eodhd';

const HISTORY_DAYS = 400; // calendar days; enough for a 200-day average plus a chart window

const isoDaysAgo = (n: number, from = new Date()) => new Date(from.getTime() - n * 86_400_000).toISOString().slice(0, 10);

export function storedBars(ticker: string, limit = 300): (Bar & { source: string })[] {
  const rows = getDb()
    .prepare('SELECT date, open, high, low, close, volume, source FROM bars WHERE ticker = ? ORDER BY date DESC LIMIT ?')
    .all(ticker, limit) as unknown as (Bar & { source: string })[];
  return rows.reverse();
}

export function latestBarDates(): Map<string, string> {
  const rows = getDb().prepare('SELECT ticker, MAX(date) AS d FROM bars GROUP BY ticker').all() as { ticker: string; d: string }[];
  return new Map(rows.map((r) => [r.ticker, r.d]));
}

function saveBars(ticker: string, bars: Bar[], source: string) {
  const db = getDb();
  const st = db.prepare(
    'INSERT OR REPLACE INTO bars (ticker, date, open, high, low, close, volume, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const b of bars) st.run(ticker, b.date, b.open, b.high, b.low, b.close, b.volume, source);
}

/** Bring daily history up to the last completed trading day. Only fetches what is missing. */
export async function ensureBars(tickers: string[], now = new Date()): Promise<{ fetched: number }> {
  const p = providersConfigured();
  const target = lastTradingDay(now);
  const latest = latestBarDates();
  const stale = tickers.filter((t) => (latest.get(t) ?? '') < target);
  if (!stale.length) return { fetched: 0 };
  const db = getDb();
  if (p.alpaca) {
    // Group by start date so up-to-date-but-one-day-behind tickers make small requests.
    const groups = new Map<string, string[]>();
    for (const t of stale) {
      const last = latest.get(t);
      const start = last ? isoDaysAgo(-1, new Date(`${last}T12:00:00Z`)) : isoDaysAgo(HISTORY_DAYS, now);
      groups.set(start, [...(groups.get(start) ?? []), t]);
    }
    let fetched = 0;
    for (const [start, list] of groups) {
      const { bars, source } = await dailyBars(list, start, target);
      db.exec('BEGIN');
      for (const [t, rows] of bars) {
        saveBars(t, rows, source);
        fetched++;
      }
      db.exec('COMMIT');
    }
    return { fetched };
  }
  if (p.eodhd && stale.length === 1) {
    const t = stale[0]!;
    const last = latest.get(t);
    const rows = await endOfDay(t, last ?? isoDaysAgo(HISTORY_DAYS, now));
    db.exec('BEGIN');
    saveBars(t, rows, EODHD_BARS_SOURCE);
    db.exec('COMMIT');
    return { fetched: 1 };
  }
  return { fetched: 0 };
}

const round = (v: number | null, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

export function swingStats(bars: Bar[], ma50: (number | null)[], ma200: (number | null)[]): SwingStats {
  const n = bars.length;
  const last = bars[n - 1];
  if (!last) {
    return { lastClose: null, change20dPct: null, distFromMa50Pct: null, distFromMa200Pct: null, high52w: null, low52w: null, volumeVsAvg20: null };
  }
  const year = bars.slice(-252);
  const avgVol = mean(bars.slice(-21, -1).map((b) => b.volume));
  return {
    lastClose: last.close,
    change20dPct: n > 20 ? pctChange(last.close, bars[n - 21]!.close) : null,
    distFromMa50Pct: pctChange(last.close, ma50[n - 1] ?? null),
    distFromMa200Pct: pctChange(last.close, ma200[n - 1] ?? null),
    // 52-week range only when a full year is stored; never from a partial window.
    high52w: year.length >= 250 ? Math.max(...year.map((b) => b.high)) : null,
    low52w: year.length >= 250 ? Math.min(...year.map((b) => b.low)) : null,
    volumeVsAvg20: avgVol && avgVol > 0 && n > 20 ? round(last.volume / avgVol) : null,
  };
}

export function barsResponse(ticker: string, window = 260): BarsResponse {
  const all = storedBars(ticker, window + 200);
  const closes = all.map((b) => b.close);
  const ma50All = sma(closes, 50);
  const ma200All = sma(closes, 200);
  const start = Math.max(0, all.length - window);
  const bars = all.slice(start).map(({ source: _s, ...b }) => b);
  const ma50 = ma50All.slice(start).map((v) => round(v));
  const ma200 = ma200All.slice(start).map((v) => round(v));
  return {
    ticker,
    bars,
    ma50,
    ma200,
    source: all[all.length - 1]?.source ?? null,
    lastBarDate: all[all.length - 1]?.date ?? null,
    stats: swingStats(all, ma50All, ma200All),
  };
}

/** Closing prices for many tickers, last `n` per ticker, oldest first. */
export function recentCloses(tickers: string[], n: number): Map<string, { date: string; close: number }[]> {
  const rows = getDb()
    .prepare(
      `SELECT ticker, date, close FROM (
         SELECT ticker, date, close, ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY date DESC) AS rn
         FROM bars WHERE ticker IN (SELECT value FROM json_each(?))
       ) WHERE rn <= ? ORDER BY ticker, date`,
    )
    .all(JSON.stringify(tickers), n) as { ticker: string; date: string; close: number }[];
  const out = new Map<string, { date: string; close: number }[]>();
  for (const r of rows) out.set(r.ticker, [...(out.get(r.ticker) ?? []), { date: r.date, close: r.close }]);
  return out;
}
