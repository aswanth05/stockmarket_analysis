/**
 * DEMO MODE (public GitHub Pages build). There is no server on Pages, so this module answers the app's
 * /api requests in the browser from a snapshot of REAL SEC EDGAR data, built by the Pages workflow
 * (server/scripts/build-demo-snapshot.ts). Prices are not included: market-data terms do not allow
 * republishing them on a public site. Missing data is shown as missing, never invented.
 * Calculations reuse the server's code, so formulas, scores and flags match the full app.
 */
import {
  easternClock,
  lastCompletedTradingDay,
  sessionAt,
  type AnnualRow,
  type BarsResponse,
  type FilingView,
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
import { median } from '../../../server/src/calculations/engine';
import { FACTORS, METRICS, VERSION } from '../../../server/src/calculations/definitions/v1';
import { buildMetrics, factorScores, riskFlags, type PriorEquity } from '../../../server/src/fundamentals/compute';

const PROVIDERS = { alpaca: false, eodhd: false, edgar: true, anthropic: false };
const DEMO_USER: SessionUser = { id: 0, email: 'demo@example.com', createdAt: '2026-11-15T00:00:00.000Z' };
const PROXIES = [
  { ticker: 'SPY', label: 'S&P 500', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE Arca' },
  { ticker: 'DIA', label: 'Dow Jones', name: 'SPDR Dow Jones Industrial Average ETF', exchange: 'NYSE Arca' },
  { ticker: 'QQQ', label: 'Nasdaq', name: 'Invesco QQQ Trust', exchange: 'Nasdaq' },
];
const TOP = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK.B', 'JPM', 'XOM', 'UNH'];
const COMPANIES = sp500.companies;
const BY_TICKER = new Map(COMPANIES.map((c) => [c.ticker, c]));
export const NO_PRICES = 'Prices are not included in the public demo.';

/* ---------- snapshot loading ---------- */

interface SummaryEntry {
  exchange: string | null;
  revenueGrowth: number | null;
  netMargin: number | null;
  period: string;
  hasAnnual?: boolean;
  latestFiling?: { form: string; filed: string } | null;
  error?: string;
}
export interface Summary {
  status: 'ok' | 'not-configured' | 'missing';
  generatedAt?: string;
  source?: string;
  period?: string;
  companies?: Record<string, SummaryEntry>;
}
interface CompanyFile {
  ticker: string;
  exchange: string | null;
  annual: AnnualRow[];
  priorEquity: PriorEquity | null;
  filings: FilingView[];
}

const base = () => `${import.meta.env.BASE_URL ?? '/'}demo-data/`;
let summaryP: Promise<Summary> | null = null;
const companyCache = new Map<string, Promise<CompanyFile | null>>();

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${base()}${path}`);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export function loadSummary(): Promise<Summary> {
  summaryP ??= getJson<Summary>('summary.json').then((s) => s ?? { status: 'missing' });
  return summaryP;
}

function loadCompany(ticker: string): Promise<CompanyFile | null> {
  let p = companyCache.get(ticker);
  if (!p) {
    p = getJson<CompanyFile>(`companies/${encodeURIComponent(ticker)}.json`);
    companyCache.set(ticker, p);
  }
  return p;
}

/** Test hook: replace the snapshot loader. */
export function setSnapshotForTests(summary: Summary, files: Record<string, CompanyFile>) {
  summaryP = Promise.resolve(summary);
  companyCache.clear();
  for (const [t, f] of Object.entries(files)) companyCache.set(t, Promise.resolve(f));
}

/* ---------- helpers ---------- */

const noQuote = (ticker: string): QuoteView => ({ ticker, price: null, prevClose: null, changePct: null, asOf: null, source: null, freshness: null, lastError: NO_PRICES });
const nameOf = (t: string) => BY_TICKER.get(t)?.name ?? PROXIES.find((p) => p.ticker === t)?.name ?? t;
const known = (t: string) => BY_TICKER.has(t) || PROXIES.some((p) => p.ticker === t);

const WL_KEY = 'ust-demo-watchlist';
function loadWatchlist(): { ticker: string; addedAt: string }[] {
  try {
    const v = JSON.parse(localStorage.getItem(WL_KEY) ?? 'null');
    if (Array.isArray(v)) return v;
  } catch {
    // storage unavailable: use the default list
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

async function watchItems(): Promise<{ items: WatchlistItem[] }> {
  const s = await loadSummary();
  return {
    items: watchlist.map((w) => ({
      ticker: w.ticker,
      name: nameOf(w.ticker),
      sector: BY_TICKER.get(w.ticker)?.sector ?? null,
      addedAt: w.addedAt,
      quote: noQuote(w.ticker),
      researchStatus: s.companies?.[w.ticker]?.hasAnnual ? 'fundamentals loaded' : 'not researched',
    })),
  };
}

class DemoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/* ---------- routes ---------- */

function marketStatus(): MarketStatusResponse {
  const now = new Date();
  const c = easternClock(now);
  return { ...sessionAt(now, calendar), etTime: c.label, etDate: c.date, lastCompletedTradingDay: lastCompletedTradingDay(now, calendar), calendarSource: calendar.source, providers: PROVIDERS };
}

async function watchlistFilings(): Promise<FilingView[]> {
  const files = await Promise.all(watchlist.map((w) => loadCompany(w.ticker)));
  return files.flatMap((f) => f?.filings ?? []).sort((a, b) => b.filed.localeCompare(a.filed));
}

async function home(): Promise<HomeResponse> {
  const counts = new Map<string, number>();
  for (const c of COMPANIES) counts.set(c.sector, (counts.get(c.sector) ?? 0) + 1);
  const filings = await watchlistFilings();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const row = (ticker: string, kind: 'Stock' | 'ETF'): MarketRow => ({ ticker, name: nameOf(ticker), sector: BY_TICKER.get(ticker)?.sector ?? null, kind, quote: noQuote(ticker), trend: [] });
  return {
    providers: PROVIDERS,
    proxies: PROXIES.map((p) => ({ ticker: p.ticker, label: p.label, quote: noQuote(p.ticker), closes: [] })),
    breadth: { advancing: 0, declining: 0, unchanged: 0, noData: COMPANIES.length, listSize: COMPANIES.length, asOf: null },
    above50: { pct: null, counted: 0, listSize: COMPANIES.length, asOf: null },
    sectorCounts: [...counts.entries()].map(([sector, count]) => ({ sector, count })).sort((a, b) => b.count - a.count),
    weekly: { weekEnding: null, previousWeekEnding: null, rows: [] },
    topMarkets: [...TOP.map((t) => row(t, 'Stock')), ...PROXIES.map((p) => row(p.ticker, 'ETF'))],
    watchlist: { count: watchlist.length, withNewFiling: new Set(filings.filter((f) => f.filed >= weekAgo).map((f) => f.ticker)).size },
    recentFilings: filings.slice(0, 8),
    aiReview: null,
  };
}

const emptyBars = (ticker: string): BarsResponse => ({
  ticker,
  bars: [],
  ma50: [],
  ma200: [],
  source: null,
  lastBarDate: null,
  stats: { lastClose: null, change20dPct: null, distFromMa50Pct: null, distFromMa200Pct: null, high52w: null, low52w: null, volumeVsAvg20: null },
});

async function research(ticker: string): Promise<ResearchResponse> {
  if (!known(ticker)) throw new DemoError(404, `${ticker} is not in the demo’s list (S&P 500 companies and SPY, DIA, QQQ).`);
  const c = BY_TICKER.get(ticker);
  const p = PROXIES.find((x) => x.ticker === ticker);
  const s = await loadSummary();
  const file = c ? await loadCompany(ticker) : null;
  const rows = file?.annual ?? [];
  const metrics = buildMetrics(rows, file?.priorEquity ?? undefined);
  const status: ResearchResponse['fundamentalsStatus'] =
    rows.length ? 'loaded' : s.status !== 'ok' ? 'not-configured' : s.companies?.[ticker]?.error ? 'error' : 'not-found';
  const seen = new Set<string>();
  const sources = [{ source: `SEC EDGAR snapshot${s.generatedAt ? `, built ${s.generatedAt.slice(0, 10)}` : ''}` }] as ResearchResponse['sources'];
  for (const r of rows.slice(0, 2)) {
    for (const ref of Object.values(r.refs)) {
      if (ref?.accn && !seen.has(ref.accn)) {
        seen.add(ref.accn);
        sources.push(ref);
      }
    }
  }
  return {
    company: {
      ticker,
      name: c?.name ?? p!.name,
      exchange: file?.exchange ?? s.companies?.[ticker]?.exchange ?? p?.exchange ?? null,
      sector: c?.sector ?? null,
      subIndustry: c?.subIndustry ?? null,
      cik: c ? c.cik : null,
      inSp500: Boolean(c),
    },
    quote: noQuote(ticker),
    annual: rows,
    metrics,
    factors: factorScores(metrics, rows),
    risks: riskFlags(metrics, rows),
    filings: file?.filings ?? [],
    aiReview: null,
    fundamentalsStatus: status,
    fundamentalsError: status === 'error' ? s.companies?.[ticker]?.error : undefined,
    sources,
  };
}

async function screener(f: ScreenerFilters): Promise<ScreenerResponse> {
  const s = await loadSummary();
  const list = COMPANIES.filter((c) => !f.sector || c.sector === f.sector);
  const rows = list
    .map((c) => {
      const e = s.companies?.[c.ticker];
      return { ticker: c.ticker, name: c.name, sector: c.sector, quote: noQuote(c.ticker), aboveMa50: null, revenueGrowth: e?.revenueGrowth ?? null, netMargin: e?.netMargin ?? null, fundamentalsPeriod: e?.period ?? null };
    })
    .filter((r) => {
      // No prices in the demo: any price-based filter matches nothing (missing data never passes).
      if (f.minPrice !== undefined || f.maxPrice !== undefined || f.minChangePct !== undefined || f.maxChangePct !== undefined || f.aboveMa50 !== undefined) return false;
      if (f.minRevenueGrowth !== undefined && (r.revenueGrowth == null || r.revenueGrowth * 100 < f.minRevenueGrowth)) return false;
      if (f.minNetMargin !== undefined && (r.netMargin == null || r.netMargin * 100 < f.minNetMargin)) return false;
      return true;
    });
  return {
    rows,
    total: list.length,
    universe: 'Saved S&P 500 list',
    fundamentalsNote:
      s.status === 'ok'
        ? `Revenue growth and net margin: SEC EDGAR calendar-year data (${s.period}), snapshot built ${s.generatedAt?.slice(0, 10)}. ${NO_PRICES} Price filters match no companies.`
        : 'The SEC data snapshot is not available yet.',
  };
}

async function sectors(): Promise<SectorsResponse> {
  const s = await loadSummary();
  const groups = new Map<string, typeof COMPANIES>();
  for (const c of COMPANIES) groups.set(c.sector, [...(groups.get(c.sector) ?? []), c]);
  const sort = <T extends { sector: string }>(a: T[]) => a.sort((x, y) => x.sector.localeCompare(y.sector));
  return {
    movement: sort([...groups.entries()].map(([sector, list]) => ({ sector, companies: list.length, withData: 0, change1d: null, change1w: null, change1m: null }))),
    outlook: sort(
      [...groups.entries()].map(([sector, list]) => {
        const e = list.map((c) => s.companies?.[c.ticker]).filter((x): x is SummaryEntry => x != null);
        const g = median(e.map((x) => x.revenueGrowth));
        const m = median(e.map((x) => x.netMargin));
        return { sector, companies: list.length, withData: e.filter((x) => x.revenueGrowth != null).length, medianRevenueGrowth: g == null ? null : Math.round(g * 1000) / 10, medianNetMargin: m == null ? null : Math.round(m * 1000) / 10, period: e[0]?.period ?? null };
      }),
    ),
    movementAsOf: null,
    outlookSource: s.status === 'ok' ? `SEC EDGAR XBRL frames, snapshot built ${s.generatedAt?.slice(0, 10)}. Medians are across companies with data.` : 'The SEC data snapshot is not available yet.',
  };
}

async function methodology(): Promise<MethodologyResponse> {
  const s = await loadSummary();
  const src = (id: keyof typeof PROVIDERS, name: string, use: string, freshness: string, configured: boolean, lastSuccess: string | null = null) => ({ id, name, use, configured, freshness, lastSuccess, lastError: null });
  return {
    metrics: Object.values(METRICS).map((m) => ({ id: m.id, name: m.name, formula: m.formula, inputs: [...m.inputs], notes: m.notes, version: VERSION })),
    factors: FACTORS.map((f) => ({ id: f.id, name: f.name, weight: f.weight, basis: f.basis })),
    sources: [
      src('edgar', 'SEC EDGAR', 'Filings and annual financials (real data in this demo)', 'Snapshot rebuilt daily', s.status === 'ok', s.generatedAt ?? null),
      src('alpaca', 'Alpaca Market Data', 'Prices in the private app only', 'Not in the public demo', false),
      src('eodhd', 'EODHD', 'Fallback prices in the private app only', 'Not in the public demo', false),
      src('anthropic', 'Anthropic Claude', 'AI reviews in the private app only', 'Not in the public demo', false),
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

async function route(method: string, path: string, body: unknown): Promise<unknown> {
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
  if (p === '/quotes') return { quotes: (q.tickers ?? '').split(',').filter(Boolean).map((t) => noQuote(t.toUpperCase())), market: marketStatus() };
  if (p === '/search') return search(q.q ?? '');
  if (p.startsWith('/research/') && p.endsWith('/ai-review')) throw new DemoError(409, 'AI reviews are off in the public demo. In the private app, Claude writes them from stored evidence within a monthly spending cap.');
  if (p.startsWith('/research/')) return research(tickerParam('/research/'));
  if (p.startsWith('/bars/')) {
    const t = tickerParam('/bars/');
    if (!known(t)) throw new DemoError(404, `${t} is not in the demo’s list.`);
    return emptyBars(t);
  }
  if (p === '/screener') {
    const n = (k: string) => (q[k] === undefined || q[k] === '' ? undefined : Number(q[k]));
    return screener({ sector: q.sector || undefined, minPrice: n('minPrice'), maxPrice: n('maxPrice'), minChangePct: n('minChangePct'), maxChangePct: n('maxChangePct'), aboveMa50: q.aboveMa50 === undefined ? undefined : q.aboveMa50 === 'true', minRevenueGrowth: n('minRevenueGrowth'), minNetMargin: n('minNetMargin') });
  }
  if (p === '/sectors') return sectors();
  if (p === '/methodology') return methodology();
  if (p === '/settings') return { user: DEMO_USER, providers: PROVIDERS, aiUsage: { monthSpendUsd: 0, monthlyBudgetUsd: null, remainingUsd: null }, sources: (await methodology()).sources };
  if (p === '/watchlist' && method === 'GET') return watchItems();
  if (p === '/watchlist' && method === 'POST') {
    const t = String((body as { ticker?: string })?.ticker ?? '').toUpperCase();
    if (!known(t)) throw new DemoError(404, `${t} is not in the demo’s list.`);
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
  try {
    return (await route(method, path, body)) as T;
  } catch (e) {
    if (e instanceof DemoError) throw Object.assign(new Error(e.message), { status: e.status });
    throw e;
  }
}
