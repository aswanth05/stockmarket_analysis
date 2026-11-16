/**
 * DEMO MODE (GitHub Pages build only). There is no server on Pages, so this module answers the app's
 * /api requests inside the browser with SAMPLE data. Prices and financials are generated from a fixed
 * seed per ticker: they are not real and are labelled "Sample data" everywhere they appear.
 * Calculations reuse the server's real code, so formulas, scores and flags behave as in the full app.
 */
import {
  easternClock,
  isTradingDay,
  lastCompletedTradingDay,
  sessionAt,
  type AnnualRow,
  type BarsResponse,
  type HomeResponse,
  type MarketRow,
  type MarketStatusResponse,
  type MethodologyResponse,
  type QuoteView,
  type ResearchResponse,
  type ScreenerFilters,
  type ScreenerResponse,
  type SectorsResponse,
  type SessionUser,
  type WatchlistItem,
} from '@ust/shared';
import sp500 from '../../../server/data/sp500.json';
import calendar from '../../../server/data/nyse-calendar.json';
import { mean, median, netMargin, pctChange, revenueGrowth, sma } from '../../../server/src/calculations/engine';
import { FACTORS, METRICS, VERSION } from '../../../server/src/calculations/definitions/v1';
import { buildMetrics, factorScores, riskFlags } from '../../../server/src/fundamentals/compute';

export const DEMO_SOURCE = 'Sample data (demo)';
const FUND_SOURCE = 'Sample data (demo), not from SEC filings';
const PROVIDERS = { alpaca: false, eodhd: false, edgar: false, anthropic: false };
const DEMO_USER: SessionUser = { id: 0, email: 'demo@example.com', createdAt: '2026-11-15T00:00:00.000Z' };

const PROXIES = [
  { ticker: 'SPY', label: 'S&P 500', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE Arca' },
  { ticker: 'DIA', label: 'Dow Jones', name: 'SPDR Dow Jones Industrial Average ETF', exchange: 'NYSE Arca' },
  { ticker: 'QQQ', label: 'Nasdaq', name: 'Invesco QQQ Trust', exchange: 'Nasdaq' },
];
const TOP = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK.B', 'JPM', 'XOM', 'UNH'];
const COMPANIES = sp500.companies;
const BY_TICKER = new Map(COMPANIES.map((c) => [c.ticker, c]));

/* ---------- deterministic sample generation ---------- */

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAYS = (() => {
  const end = lastCompletedTradingDay(new Date(), calendar);
  const out: string[] = [];
  const d = new Date(`${end}T12:00:00Z`);
  while (out.length < 320) {
    const iso = d.toISOString().slice(0, 10);
    if (isTradingDay(iso, calendar)) out.push(iso);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
})();

/** 4:00 PM Eastern on a date, as an ISO instant (handles daylight time). */
function closeInstant(date: string) {
  for (const off of ['-04:00', '-05:00']) {
    const t = new Date(`${date}T16:00:00${off}`);
    if (easternClock(t).minutes === 960) return t.toISOString();
  }
  return `${date}T21:00:00.000Z`;
}

interface Bar { date: string; open: number; high: number; low: number; close: number; volume: number }
const barCache = new Map<string, Bar[]>();
function bars(ticker: string): Bar[] {
  const hit = barCache.get(ticker);
  if (hit) return hit;
  const r = rng(hash(ticker));
  let p = 20 + r() * 480;
  const drift = (r() - 0.42) * 0.0018;
  const vol = 0.012 + r() * 0.02;
  const out = DAYS.map((date) => {
    const open = p;
    p = Math.max(1, p * (1 + drift + (r() - 0.5) * vol * 2));
    const round = (v: number) => Math.round(v * 100) / 100;
    return {
      date,
      open: round(open),
      high: round(Math.max(open, p) * (1 + r() * 0.01)),
      low: round(Math.min(open, p) * (1 - r() * 0.01)),
      close: round(p),
      volume: Math.round(2e6 + r() * 6e7),
    };
  });
  barCache.set(ticker, out);
  return out;
}

function quote(ticker: string): QuoteView {
  const b = bars(ticker);
  const last = b.at(-1)!;
  const status = sessionAt(new Date(), calendar).status;
  if (status === 'closed') {
    return { ticker, price: last.close, prevClose: b.at(-2)!.close, changePct: pctChange(last.close, b.at(-2)!.close), asOf: closeInstant(last.date), source: DEMO_SOURCE, freshness: 'delayed', delayMinutes: 15 };
  }
  // During a session, a sample "delayed" price moves a little from the last close.
  const r = rng(hash(ticker) ^ Math.floor(Date.now() / 60_000));
  const price = Math.round(last.close * (1 + (r() - 0.5) * 0.03) * 100) / 100;
  return { ticker, price, prevClose: last.close, changePct: pctChange(price, last.close), asOf: new Date(Date.now() - 15 * 60_000).toISOString(), source: DEMO_SOURCE, freshness: 'delayed', delayMinutes: 15 };
}

const ref = { source: FUND_SOURCE };
function annual(ticker: string): AnnualRow[] {
  const r = rng(hash(`${ticker}:fund`));
  let rev = 2e9 + r() * 120e9;
  const growthBase = (r() - 0.25) * 0.25;
  const marginBase = (r() - 0.15) * 0.3;
  let equity = rev * (0.2 + r() * 0.6) * (r() < 0.05 ? -1 : 1);
  const rows: AnnualRow[] = [];
  for (let y = 2021; y <= 2025; y++) {
    rev *= 1 + growthBase + (r() - 0.5) * 0.1;
    const ni = rev * (marginBase + (r() - 0.5) * 0.05);
    const cfo = ni * 1.15 + rev * 0.03;
    const capex = rev * (0.02 + r() * 0.08);
    equity += ni * 0.5;
    rows.push({
      end: `${y}-12-31`,
      revenue: Math.round(rev),
      netIncome: Math.round(ni),
      operatingCashFlow: Math.round(cfo),
      capex: Math.round(capex),
      freeCashFlow: Math.round(cfo - capex),
      equity: Math.round(equity),
      refs: { revenue: ref, netIncome: ref, operatingCashFlow: ref, capex: ref, equity: ref },
    });
  }
  return rows.reverse();
}

const marketRow = (ticker: string, kind: 'Stock' | 'ETF'): MarketRow => {
  const c = BY_TICKER.get(ticker);
  const p = PROXIES.find((x) => x.ticker === ticker);
  return { ticker, name: c?.name ?? p?.name ?? ticker, sector: c?.sector ?? null, kind, quote: quote(ticker), trend: bars(ticker).slice(-10).map((b) => b.close) };
};

const aboveMa50 = (t: string) => {
  const c = bars(t).map((b) => b.close);
  const m = sma(c, 50).at(-1);
  return m == null ? null : c.at(-1)! > m;
};

/* ---------- watchlist (kept in this browser only) ---------- */

const WL_KEY = 'ust-demo-watchlist';
function loadWatchlist(): { ticker: string; addedAt: string }[] {
  try {
    const v = JSON.parse(localStorage.getItem(WL_KEY) ?? 'null');
    if (Array.isArray(v)) return v;
  } catch {
    // storage unavailable: fall back to the default list
  }
  return ['AAPL', 'MSFT', 'NVDA'].map((ticker) => ({ ticker, addedAt: DEMO_USER.createdAt }));
}
let watchlist = loadWatchlist();
function saveWatchlist() {
  try {
    localStorage.setItem(WL_KEY, JSON.stringify(watchlist));
  } catch {
    // ignore: the list still works for this visit
  }
}
const watchItems = (): { items: WatchlistItem[] } => ({
  items: watchlist.map((w) => ({
    ticker: w.ticker,
    name: BY_TICKER.get(w.ticker)?.name ?? PROXIES.find((p) => p.ticker === w.ticker)?.name ?? w.ticker,
    sector: BY_TICKER.get(w.ticker)?.sector ?? null,
    addedAt: w.addedAt,
    quote: quote(w.ticker),
    researchStatus: 'fundamentals loaded',
  })),
});

/* ---------- route handlers ---------- */

class DemoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function marketStatus(): MarketStatusResponse {
  const now = new Date();
  const s = sessionAt(now, calendar);
  return { ...s, etTime: easternClock(now).label, etDate: easternClock(now).date, lastCompletedTradingDay: lastCompletedTradingDay(now, calendar), calendarSource: calendar.source, providers: PROVIDERS };
}

function weekly() {
  const byWeek = new Map<string, string>();
  for (const d of DAYS.slice(-20)) {
    const dt = new Date(`${d}T12:00:00Z`);
    const monday = new Date(dt.getTime() - ((dt.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    byWeek.set(monday, d);
  }
  const [w0, w1, w2] = [...byWeek.values()].slice(-3) as [string, string, string];
  const sectors = new Map<string, { a: (number | null)[]; b: (number | null)[] }>();
  for (const c of COMPANIES) {
    const m = new Map(bars(c.ticker).slice(-20).map((b) => [b.date, b.close]));
    const e = sectors.get(c.sector) ?? { a: [], b: [] };
    e.a.push(pctChange(m.get(w2) ?? null, m.get(w1) ?? null));
    e.b.push(pctChange(m.get(w1) ?? null, m.get(w0) ?? null));
    sectors.set(c.sector, e);
  }
  const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
  return {
    weekEnding: w2,
    previousWeekEnding: w1,
    rows: [...sectors.entries()].map(([sector, e]) => ({ sector, thisWeek: r2(mean(e.a)), lastWeek: r2(mean(e.b)) })).sort((x, y) => x.sector.localeCompare(y.sector)),
  };
}

function home(): HomeResponse {
  const qs = COMPANIES.map((c) => quote(c.ticker));
  const above = COMPANIES.map((c) => aboveMa50(c.ticker));
  const counted = above.filter((v) => v != null).length;
  const counts = new Map<string, number>();
  for (const c of COMPANIES) counts.set(c.sector, (counts.get(c.sector) ?? 0) + 1);
  return {
    providers: PROVIDERS,
    proxies: PROXIES.map((p) => ({ ticker: p.ticker, label: p.label, quote: quote(p.ticker), closes: bars(p.ticker).slice(-260).map((b) => ({ date: b.date, value: b.close })) })),
    breadth: {
      advancing: qs.filter((q) => (q.changePct ?? 0) > 0).length,
      declining: qs.filter((q) => (q.changePct ?? 0) < 0).length,
      unchanged: qs.filter((q) => q.changePct === 0).length,
      noData: 0,
      listSize: COMPANIES.length,
      asOf: qs[0]?.asOf ?? null,
    },
    above50: { pct: Math.round((above.filter((v) => v === true).length / counted) * 1000) / 10, counted, listSize: COMPANIES.length, asOf: DAYS.at(-1)! },
    sectorCounts: [...counts.entries()].map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count),
    weekly: weekly(),
    topMarkets: [...TOP.map((t) => marketRow(t, 'Stock')), ...PROXIES.map((p) => marketRow(p.ticker, 'ETF'))],
    watchlist: { count: watchlist.length, withNewFiling: 0 },
    recentFilings: [],
    aiReview: null,
  };
}

function barsResponse(ticker: string, days: number): BarsResponse {
  const all = bars(ticker);
  const closes = all.map((b) => b.close);
  const m50 = sma(closes, 50);
  const m200 = sma(closes, 200);
  const start = Math.max(0, all.length - days);
  const last = all.at(-1)!;
  const year = all.slice(-252);
  const avgVol = mean(all.slice(-21, -1).map((b) => b.volume));
  const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
  return {
    ticker,
    bars: all.slice(start),
    ma50: m50.slice(start).map(r2),
    ma200: m200.slice(start).map(r2),
    source: DEMO_SOURCE,
    lastBarDate: last.date,
    stats: {
      lastClose: last.close,
      change20dPct: pctChange(last.close, all.at(-21)!.close),
      distFromMa50Pct: pctChange(last.close, m50.at(-1) ?? null),
      distFromMa200Pct: pctChange(last.close, m200.at(-1) ?? null),
      high52w: Math.max(...year.map((b) => b.high)),
      low52w: Math.min(...year.map((b) => b.low)),
      volumeVsAvg20: avgVol ? r2(last.volume / avgVol) : null,
    },
  };
}

function research(ticker: string): ResearchResponse {
  const c = BY_TICKER.get(ticker);
  const p = PROXIES.find((x) => x.ticker === ticker);
  if (!c && !p) throw new DemoError(404, `${ticker} is not in the demo’s list (S&P 500 companies and SPY, DIA, QQQ).`);
  const rows = c ? annual(ticker) : [];
  const prev = rows[1];
  const metrics = c ? buildMetrics(rows, prev?.equity != null ? { value: prev.equity, end: prev.end, ref } : undefined) : [];
  return {
    company: { ticker, name: c?.name ?? p!.name, exchange: p?.exchange ?? 'NYSE or Nasdaq (exchange loads from SEC EDGAR in the full app)', sector: c?.sector ?? null, subIndustry: c?.subIndustry ?? null, cik: c ? c.cik : null, inSp500: Boolean(c) },
    quote: quote(ticker),
    annual: rows,
    metrics,
    factors: factorScores(metrics, rows),
    risks: riskFlags(metrics, rows),
    filings: [],
    aiReview: null,
    fundamentalsStatus: c ? 'loaded' : 'not-found',
    sources: [{ source: `Prices: ${DEMO_SOURCE}` }, ...(c ? [{ source: `Financials: ${FUND_SOURCE}` }] : [])],
  };
}

function fundamentalsFor(ticker: string) {
  const [cur, prev] = annual(ticker);
  return {
    revenueGrowth: revenueGrowth(cur!.revenue, prev!.revenue).value,
    netMargin: netMargin(cur!.netIncome, cur!.revenue).value,
    period: 'FY2025 vs FY2024 (sample)',
  };
}

function screener(f: ScreenerFilters): ScreenerResponse {
  const rows = COMPANIES.filter((c) => !f.sector || c.sector === f.sector)
    .map((c) => ({ ticker: c.ticker, name: c.name, sector: c.sector, quote: quote(c.ticker), aboveMa50: aboveMa50(c.ticker), ...fundamentalsFor(c.ticker), fundamentalsPeriod: 'FY2025 vs FY2024 (sample)' }))
    .filter((r) => {
      const p = r.quote.price;
      const ch = r.quote.changePct;
      if (f.minPrice !== undefined && (p == null || p < f.minPrice)) return false;
      if (f.maxPrice !== undefined && (p == null || p > f.maxPrice)) return false;
      if (f.minChangePct !== undefined && (ch == null || ch < f.minChangePct)) return false;
      if (f.maxChangePct !== undefined && (ch == null || ch > f.maxChangePct)) return false;
      if (f.aboveMa50 !== undefined && r.aboveMa50 !== f.aboveMa50) return false;
      if (f.minRevenueGrowth !== undefined && (r.revenueGrowth == null || r.revenueGrowth * 100 < f.minRevenueGrowth)) return false;
      if (f.minNetMargin !== undefined && (r.netMargin == null || r.netMargin * 100 < f.minNetMargin)) return false;
      return true;
    })
    .map(({ period: _p, ...r }) => r);
  return { rows, total: COMPANIES.filter((c) => !f.sector || c.sector === f.sector).length, universe: 'Saved S&P 500 list', fundamentalsNote: 'Demo: revenue growth and net margin are sample values, not SEC data.' };
}

function sectors(): SectorsResponse {
  const groups = new Map<string, typeof COMPANIES>();
  for (const c of COMPANIES) groups.set(c.sector, [...(groups.get(c.sector) ?? []), c]);
  const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
  const back = (t: string, n: number) => pctChange(bars(t).at(-1)!.close, bars(t).at(-1 - n)!.close);
  return {
    movement: [...groups.entries()].map(([sector, list]) => ({
      sector,
      companies: list.length,
      withData: list.length,
      change1d: r2(mean(list.map((c) => quote(c.ticker).changePct))),
      change1w: r2(mean(list.map((c) => back(c.ticker, 5)))),
      change1m: r2(mean(list.map((c) => back(c.ticker, 21)))),
    })).sort((a, b) => a.sector.localeCompare(b.sector)),
    outlook: [...groups.entries()].map(([sector, list]) => {
      const f = list.map((c) => fundamentalsFor(c.ticker));
      const g = median(f.map((x) => x.revenueGrowth));
      const m = median(f.map((x) => x.netMargin));
      return { sector, companies: list.length, withData: list.length, medianRevenueGrowth: g == null ? null : Math.round(g * 1000) / 10, medianNetMargin: m == null ? null : Math.round(m * 1000) / 10, period: 'FY2025 vs FY2024 (sample)' };
    }).sort((a, b) => a.sector.localeCompare(b.sector)),
    movementAsOf: quote('SPY').asOf,
    outlookSource: 'Demo: sample annual figures, not SEC data. The full app uses SEC EDGAR XBRL frames.',
  };
}

function methodology(): MethodologyResponse {
  const src = (id: keyof typeof PROVIDERS, name: string, use: string, freshness: string) => ({ id, name, use, configured: false, freshness, lastSuccess: null, lastError: null });
  return {
    metrics: Object.values(METRICS).map((m) => ({ id: m.id, name: m.name, formula: m.formula, inputs: [...m.inputs], notes: m.notes, version: VERSION })),
    factors: FACTORS.map((f) => ({ id: f.id, name: f.name, weight: f.weight, basis: f.basis })),
    sources: [
      src('alpaca', 'Alpaca Market Data', 'Live quotes and daily price history (not used in the demo)', 'Real-time for the IEX exchange only'),
      src('eodhd', 'EODHD', 'Fallback quotes (not used in the demo)', 'Delayed 15–20 minutes'),
      src('edgar', 'SEC EDGAR', 'Filings and financials (not used in the demo)', 'As filed'),
      src('anthropic', 'Anthropic Claude', 'AI reviews (off in the demo)', 'Each review shows its evidence date'),
    ],
    universe: { name: 'S&P 500 constituents', source: sp500.source, retrievedAt: sp500.retrievedAt, size: COMPANIES.length },
    calendar: { source: calendar.source, retrievedAt: calendar.retrievedAt },
  };
}

function search(q: string) {
  const t = q.trim().toUpperCase();
  if (!t) return { results: [] };
  const all = [...PROXIES.map((p) => ({ ticker: p.ticker, name: p.name, exchange: p.exchange })), ...COMPANIES.map((c) => ({ ticker: c.ticker, name: c.name, exchange: null }))];
  return { results: all.filter((x) => x.ticker.startsWith(t) || x.name.toUpperCase().includes(t)).sort((a, b) => Number(b.ticker === t) - Number(a.ticker === t) || a.ticker.length - b.ticker.length).slice(0, 10) };
}

function route(method: string, path: string, body: unknown): unknown {
  const url = new URL(path, 'http://demo');
  const p = url.pathname;
  const q = Object.fromEntries(url.searchParams);
  const tickerParam = (prefix: string) => decodeURIComponent(p.slice(prefix.length).split('/')[0] ?? '').toUpperCase();

  if (p === '/auth/me' || p === '/auth/login' || p === '/auth/signup') return { user: DEMO_USER };
  if (p === '/auth/config') return { signupAllowed: false, passwordRules: 'Accounts are not used in the demo.' };
  if (p === '/auth/logout') return { ok: true };
  if (p === '/auth/password') throw new DemoError(400, 'Passwords cannot be changed in the demo.');
  if (p === '/health') return { status: 'ok', serverTime: new Date().toISOString() };
  if (p === '/market/status') return marketStatus();
  if (p === '/home') return home();
  if (p === '/quotes') return { quotes: (q.tickers ?? '').split(',').filter(Boolean).map((t) => quote(t.toUpperCase())), market: marketStatus() };
  if (p === '/search') return search(q.q ?? '');
  if (p.startsWith('/research/') && p.endsWith('/ai-review')) throw new DemoError(409, 'AI reviews are off in the demo. In the full app, Claude writes them from stored evidence within a monthly spending cap.');
  if (p.startsWith('/research/')) return research(tickerParam('/research/'));
  if (p.startsWith('/bars/')) {
    const t = tickerParam('/bars/');
    if (!BY_TICKER.has(t) && !PROXIES.some((x) => x.ticker === t)) throw new DemoError(404, `${t} is not in the demo’s list.`);
    return barsResponse(t, Math.min(Number(q.days) || 260, 320));
  }
  if (p === '/screener') {
    const n = (k: string) => (q[k] === undefined || q[k] === '' ? undefined : Number(q[k]));
    return screener({ sector: q.sector || undefined, minPrice: n('minPrice'), maxPrice: n('maxPrice'), minChangePct: n('minChangePct'), maxChangePct: n('maxChangePct'), aboveMa50: q.aboveMa50 === undefined ? undefined : q.aboveMa50 === 'true', minRevenueGrowth: n('minRevenueGrowth'), minNetMargin: n('minNetMargin') });
  }
  if (p === '/sectors') return sectors();
  if (p === '/methodology') return methodology();
  if (p === '/settings') return { user: DEMO_USER, providers: PROVIDERS, aiUsage: { monthSpendUsd: 0, monthlyBudgetUsd: null, remainingUsd: null }, sources: methodology().sources };
  if (p === '/watchlist' && method === 'GET') return watchItems();
  if (p === '/watchlist' && method === 'POST') {
    const t = String((body as { ticker?: string })?.ticker ?? '').toUpperCase();
    if (!BY_TICKER.has(t) && !PROXIES.some((x) => x.ticker === t)) throw new DemoError(404, `${t} is not in the demo’s list.`);
    if (!watchlist.some((w) => w.ticker === t)) watchlist = [...watchlist, { ticker: t, addedAt: new Date().toISOString() }];
    saveWatchlist();
    return watchItems();
  }
  if (p.startsWith('/watchlist/') && method === 'DELETE') {
    const t = tickerParam('/watchlist/');
    watchlist = watchlist.filter((w) => w.ticker !== t);
    saveWatchlist();
    return watchItems();
  }
  throw new DemoError(404, 'Not available in the demo.');
}

/** Same contract as the real API client: resolves with data or throws with a status and message. */
export async function demoCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 60));
  try {
    return route(method, path, body) as T;
  } catch (e) {
    if (e instanceof DemoError) throw Object.assign(new Error(e.message), { status: e.status });
    throw e;
  }
}
