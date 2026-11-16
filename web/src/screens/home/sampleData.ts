/*
 * PLACEHOLDER DATA for step 30 (Home layout). Every number here is made up.
 * It is generated from a fixed seed so the page looks the same on every load.
 * Step 33 replaces this file with stored provider data.
 */

export const SAMPLE_SOURCE = 'Sample data';
/** Friday close, 4:00 PM ET. */
export const SAMPLE_AS_OF = '2026-11-13T21:00:00Z';

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The last `n` weekdays ending on the sample date, oldest first (YYYY-MM-DD). */
function weekdays(n: number): string[] {
  const out: string[] = [];
  const d = new Date('2026-11-13T12:00:00Z');
  while (out.length < n) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

function walk(seed: number, n: number, start: number, drift: number, vol: number): number[] {
  const r = seeded(seed);
  const out = [start];
  for (let i = 1; i < n; i++) out.push(out[i - 1]! * (1 + drift + (r() - 0.5) * vol));
  return out.map((v) => Math.round(v * 100) / 100);
}

export interface Point {
  date: string;
  value: number;
}

const DAYS = 260;
const dates = weekdays(DAYS);
const toPoints = (values: number[]): Point[] => values.map((value, i) => ({ date: dates[i]!, value }));

export const INDEX_PROXIES = [
  { ticker: 'SPY', label: 'S&P 500', points: toPoints(walk(11, DAYS, 520, 0.0006, 0.022)) },
  { ticker: 'DIA', label: 'Dow Jones', points: toPoints(walk(23, DAYS, 410, 0.0004, 0.02)) },
  { ticker: 'QQQ', label: 'Nasdaq', points: toPoints(walk(37, DAYS, 450, 0.0008, 0.028)) },
] as const;

export const BREADTH = { advancing: 312, declining: 181, unchanged: 10, listSize: 503 };
export const BREADTH_TREND = [248, 270, 231, 290, 305, 284, 312];

/** Share of the saved S&P 500 list closing above its own 50-day average, in percent. */
export const ABOVE_50DMA_PCT = 58;

export const WATCHLIST = { count: 8, withNewFiling: 3 };

export const SECTOR_WEIGHTS = [
  { sector: 'Information Technology', weight: 31.5 },
  { sector: 'Financials', weight: 13.2 },
  { sector: 'Health Care', weight: 10.4 },
  { sector: 'Consumer Discretionary', weight: 10.1 },
  { sector: 'Communication Services', weight: 9.2 },
  { sector: 'Industrials', weight: 8.4 },
  { sector: 'Other 5 sectors', weight: 17.2 },
];

export const WEEKLY_SECTOR_RETURNS = [
  { sector: 'Technology', thisWeek: 2.1, lastWeek: -0.8 },
  { sector: 'Financials', thisWeek: 0.9, lastWeek: 1.2 },
  { sector: 'Health Care', thisWeek: -0.6, lastWeek: 0.4 },
  { sector: 'Energy', thisWeek: -1.4, lastWeek: 2.0 },
  { sector: 'Industrials', thisWeek: 1.1, lastWeek: 0.3 },
  { sector: 'Utilities', thisWeek: 0.2, lastWeek: -0.5 },
];

export interface MarketRow {
  ticker: string;
  name: string;
  kind: 'Stock' | 'ETF';
  price: number | null;
  changePct: number | null;
  trend: number[];
}

const tr = (seed: number, drift: number) => walk(seed, 10, 100, drift, 0.03);

export const TOP_MARKETS: MarketRow[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', kind: 'Stock', price: 231.42, changePct: 1.12, trend: tr(1, 0.002) },
  { ticker: 'MSFT', name: 'Microsoft Corp.', kind: 'Stock', price: 468.1, changePct: 0.54, trend: tr(2, 0.001) },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', kind: 'Stock', price: 142.87, changePct: 2.86, trend: tr(3, 0.004) },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', kind: 'Stock', price: 211.05, changePct: -0.73, trend: tr(4, -0.001) },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', kind: 'Stock', price: 248.6, changePct: 0.31, trend: tr(5, 0.001) },
  { ticker: 'XOM', name: 'Exxon Mobil Corp.', kind: 'Stock', price: 117.9, changePct: -1.48, trend: tr(6, -0.003) },
  { ticker: 'UNH', name: 'UnitedHealth Group', kind: 'Stock', price: null, changePct: null, trend: [] },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF', kind: 'ETF', price: null, changePct: null, trend: tr(7, 0.001) },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', kind: 'ETF', price: null, changePct: null, trend: tr(8, 0.002) },
];
// Fill the ETF rows from the same sample series the index chart uses, so the page agrees with itself.
for (const row of TOP_MARKETS) {
  const proxy = INDEX_PROXIES.find((p) => p.ticker === row.ticker);
  if (!proxy) continue;
  const last = proxy.points[proxy.points.length - 1]!.value;
  const prev = proxy.points[proxy.points.length - 2]!.value;
  row.price = last;
  row.changePct = Math.round(((last - prev) / prev) * 10000) / 100;
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function candles(seed: number, closes: number[]): Candle[] {
  const r = seeded(seed);
  return closes.map((close, i) => {
    const open = i === 0 ? close : Math.round(closes[i - 1]! * (1 + (r() - 0.5) * 0.01) * 100) / 100;
    const high = Math.round(Math.max(open, close) * (1 + r() * 0.012) * 100) / 100;
    const low = Math.round(Math.min(open, close) * (1 - r() * 0.012) * 100) / 100;
    return { date: dates[i]!, open, high, low, close, volume: Math.round(30e6 + r() * 50e6) };
  });
}

/**
 * Simple moving average. Returns null until there are `n` values (never a partial average).
 * Step 36 moves this calculation to the server, per CLAUDE.md.
 */
export function sma(values: number[], n: number): (number | null)[] {
  let sum = 0;
  return values.map((v, i) => {
    sum += v;
    if (i >= n) sum -= values[i - n]!;
    return i >= n - 1 ? Math.round((sum / n) * 100) / 100 : null;
  });
}

const aaplCloses = walk(91, DAYS, 180, 0.0011, 0.03);
export const PRICE_CHART = {
  ticker: 'AAPL',
  candles: candles(92, aaplCloses),
  ma50: sma(aaplCloses, 50),
  ma200: sma(aaplCloses, 200),
};
export const PRICE_CHART_TICKERS = ['AAPL'];

export const AI_REVIEW = {
  ticker: 'AAPL',
  evidenceDate: '2026-11-13',
  sourceCount: 5,
  score: 64,
  method: 'Long-term factor score v0: growth, margin, ROE, free cash flow, equal weights',
  summary:
    'Sample text. A real review explains the stored filings and price history it cites, and never computes numbers itself.',
};

export const RECENT_FILINGS = [
  { ticker: 'NVDA', form: '8-K', title: 'Current report', filed: '2026-11-12' },
  { ticker: 'AMZN', form: '8-K', title: 'Current report', filed: '2026-11-10' },
  { ticker: 'JPM', form: '10-Q', title: 'Quarterly report', filed: '2026-11-04' },
  { ticker: 'AAPL', form: '10-K', title: 'Annual report', filed: '2026-10-31' },
  { ticker: 'MSFT', form: '10-Q', title: 'Quarterly report', filed: '2026-10-29' },
];

/** EDGAR company filing list for a ticker (a real public page). */
export const edgarCompanyUrl = (ticker: string) =>
  `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(ticker)}&type=&dateb=&owner=include&count=40`;
