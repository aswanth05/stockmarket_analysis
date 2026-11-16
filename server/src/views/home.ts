import type { FilingView, HomeResponse } from '@ust/shared';
import { recentCloses } from '../bars/service';
import { mean, pctChange } from '../calculations/engine';
import { providersConfigured } from '../config';
import { getDb } from '../db';
import { latestReviewAny } from '../ai/service';
import { filingUrl } from '../providers/edgar';
import { getQuotes } from '../quotes/service';
import { INDEX_PROXIES } from '../universe';
import { aboveMa50, emptyQuote, latestAsOf, marketRows, sp500Rows, watchlistTickers } from './common';

/** Large, widely followed names for the Top markets table (a fixed, disclosed list, not a ranking). */
export const TOP_MARKET_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK.B', 'JPM', 'XOM', 'UNH'];

/** Monday-based week key for a YYYY-MM-DD date. */
function weekKey(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
  return monday.toISOString().slice(0, 10);
}

/** Last trading date of each of the most recent weeks, from SPY's stored bars (the trading calendar as traded). */
export function weekEnds(count = 3): string[] {
  const dates = (recentCloses(['SPY'], 20).get('SPY') ?? []).map((c) => c.date);
  const byWeek = new Map<string, string>();
  for (const d of dates) byWeek.set(weekKey(d), d);
  return [...byWeek.values()].slice(-count);
}

export function weeklySectorReturns(rows: { ticker: string; sector: string }[]) {
  const ends = weekEnds(3); // [week before last, last week, this week]
  if (ends.length < 3) return { weekEnding: null, previousWeekEnding: null, rows: [] };
  const [w0, w1, w2] = ends as [string, string, string];
  const closes = recentCloses(rows.map((r) => r.ticker), 20);
  const bySector = new Map<string, { thisWeek: (number | null)[]; lastWeek: (number | null)[] }>();
  for (const r of rows) {
    const c = new Map((closes.get(r.ticker) ?? []).map((x) => [x.date, x.close]));
    const e = bySector.get(r.sector) ?? { thisWeek: [], lastWeek: [] };
    e.thisWeek.push(pctChange(c.get(w2) ?? null, c.get(w1) ?? null));
    e.lastWeek.push(pctChange(c.get(w1) ?? null, c.get(w0) ?? null));
    bySector.set(r.sector, e);
  }
  const round = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
  return {
    weekEnding: w2,
    previousWeekEnding: w1,
    rows: [...bySector.entries()]
      .map(([sector, e]) => ({ sector, thisWeek: round(mean(e.thisWeek)), lastWeek: round(mean(e.lastWeek)) }))
      .sort((a, b) => a.sector.localeCompare(b.sector)),
  };
}

export function watchlistFilings(userId: number, days: number | null, limit: number): FilingView[] {
  const since = days == null ? '0000' : new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = getDb()
    .prepare(
      `SELECT c.ticker, f.cik, f.accn, f.form, f.filed, f.report_date, f.primary_doc, f.description
       FROM watchlist w JOIN companies c ON c.ticker = w.ticker JOIN filings f ON f.cik = c.cik
       WHERE w.user_id = ? AND f.filed >= ? ORDER BY f.filed DESC LIMIT ?`,
    )
    .all(userId, since, limit) as { ticker: string; cik: string; accn: string; form: string; filed: string; report_date: string | null; primary_doc: string | null; description: string | null }[];
  return rows.map((r) => ({
    ticker: r.ticker,
    form: r.form,
    filed: r.filed,
    reportDate: r.report_date,
    description: r.description || r.form,
    accn: r.accn,
    url: filingUrl(r.cik, r.accn, r.primary_doc),
  }));
}

export function homeView(userId: number): HomeResponse {
  const sp = sp500Rows();
  const spTickers = sp.map((r) => r.ticker);
  const quotes = getQuotes(spTickers);
  let adv = 0;
  let dec = 0;
  let unch = 0;
  let none = 0;
  for (const q of quotes.values()) {
    if (q.changePct == null) none++;
    else if (q.changePct > 0) adv++;
    else if (q.changePct < 0) dec++;
    else unch++;
  }

  const above = aboveMa50(spTickers);
  const counted = [...above.values()].filter((v) => v != null).length;
  const nAbove = [...above.values()].filter((v) => v === true).length;
  // Only report the share when most of the list has enough history; a partial count would mislead.
  const above50Pct = counted >= sp.length * 0.9 ? Math.round((nAbove / counted) * 1000) / 10 : null;
  const lastBar = (recentCloses(['SPY'], 1).get('SPY') ?? [])[0]?.date ?? null;

  const sectorCounts = new Map<string, number>();
  for (const r of sp) sectorCounts.set(r.sector, (sectorCounts.get(r.sector) ?? 0) + 1);

  const proxyQuotes = getQuotes(INDEX_PROXIES.map((p) => p.ticker));
  const proxyCloses = recentCloses(INDEX_PROXIES.map((p) => p.ticker), 260);

  const byTicker = new Map(sp.map((r) => [r.ticker, r]));
  const wl = watchlistTickers(userId);
  const newFilings = watchlistFilings(userId, 7, 500);

  return {
    providers: providersConfigured(),
    proxies: INDEX_PROXIES.map((p) => ({
      ticker: p.ticker,
      label: p.label,
      quote: proxyQuotes.get(p.ticker) ?? emptyQuote(p.ticker),
      closes: (proxyCloses.get(p.ticker) ?? []).map((c) => ({ date: c.date, value: c.close })),
    })),
    breadth: { advancing: adv, declining: dec, unchanged: unch, noData: none, listSize: sp.length, asOf: latestAsOf(quotes.values()) },
    above50: { pct: above50Pct, counted, listSize: sp.length, asOf: lastBar },
    sectorCounts: [...sectorCounts.entries()].map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count),
    weekly: weeklySectorReturns(sp),
    topMarkets: marketRows([
      ...TOP_MARKET_TICKERS.filter((t) => byTicker.has(t)).map((t) => ({ ticker: t, name: byTicker.get(t)!.name, sector: byTicker.get(t)!.sector, kind: 'Stock' as const })),
      ...INDEX_PROXIES.map((p) => ({ ticker: p.ticker, name: p.name, sector: null, kind: 'ETF' as const })),
    ]),
    watchlist: { count: wl.length, withNewFiling: new Set(newFilings.map((f) => f.ticker)).size },
    recentFilings: watchlistFilings(userId, null, 8),
    aiReview: latestReviewAny(wl),
  };
}
