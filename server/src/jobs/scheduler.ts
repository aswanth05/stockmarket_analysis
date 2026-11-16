import { ensureBars } from '../bars/service';
import { providersConfigured } from '../config';
import { getDb, nowIso } from '../db';
import { loadCompany, refreshFrames } from '../fundamentals/service';
import { marketStatus } from '../market/calendar';
import { tickersWithExchange } from '../providers/edgar';
import { getQuotes, refreshQuotes } from '../quotes/service';
import { PROXY_TICKERS, SP500_TICKERS } from '../universe';
import { allWatchedTickers, watchlistTickers } from '../views/common';

/**
 * Background refresh. Polling, not streaming (PROJECT_STEPS 41: start with polling).
 * Each job records its last run so restarts do not re-fetch everything.
 */
interface Job {
  name: string;
  everyMs: () => number;
  enabled: () => boolean;
  run: () => Promise<void>;
}

const MIN = 60_000;
const p = () => providersConfigured();
const universe = () => [...new Set([...PROXY_TICKERS, ...SP500_TICKERS, ...allWatchedTickers()])];

const JOBS: Job[] = [
  {
    name: 'quotes',
    // Every minute while any session is running; hourly when the market is closed.
    everyMs: () => (marketStatus().status === 'closed' ? 60 * MIN : MIN),
    enabled: () => p().alpaca,
    run: async () => {
      await refreshQuotes(universe());
    },
  },
  {
    name: 'daily-bars',
    everyMs: () => 30 * MIN,
    enabled: () => p().alpaca,
    run: async () => {
      await ensureBars(universe());
    },
  },
  {
    name: 'sec-tickers',
    everyMs: () => 7 * 24 * 60 * MIN,
    enabled: () => p().edgar,
    run: async () => {
      const rows = await tickersWithExchange();
      const db = getDb();
      const at = nowIso();
      const up = db.prepare(`
        INSERT INTO companies (ticker, name, cik, exchange, in_sp500, is_etf, updated_at) VALUES (?, ?, ?, ?, 0, 0, ?)
        ON CONFLICT(ticker) DO UPDATE SET exchange = excluded.exchange, cik = COALESCE(companies.cik, excluded.cik)`);
      db.exec('BEGIN');
      for (const r of rows) if (r.exchange === 'NYSE' || r.exchange === 'Nasdaq') up.run(r.ticker, r.name, r.cik, r.exchange, at);
      db.exec('COMMIT');
    },
  },
  {
    name: 'sec-frames',
    everyMs: () => 7 * 24 * 60 * MIN,
    enabled: () => p().edgar,
    run: () => refreshFrames(),
  },
  {
    name: 'watchlist-filings',
    everyMs: () => 6 * 60 * MIN,
    enabled: () => p().edgar,
    run: async () => {
      const ciks = getDb()
        .prepare('SELECT DISTINCT c.cik FROM watchlist w JOIN companies c ON c.ticker = w.ticker WHERE c.cik IS NOT NULL AND c.is_etf = 0')
        .all() as { cik: string }[];
      for (const { cik } of ciks) await loadCompany(cik).catch(() => undefined);
    },
  },
];

const running = new Set<string>();

function lastRun(name: string): number {
  const r = getDb().prepare('SELECT last_run_at FROM job_runs WHERE job = ?').get(name) as { last_run_at: string } | undefined;
  return r ? Date.parse(r.last_run_at) : 0;
}

async function runJob(job: Job) {
  if (running.has(job.name)) return;
  running.add(job.name);
  const db = getDb();
  const at = nowIso();
  try {
    await job.run();
    db.prepare('INSERT OR REPLACE INTO job_runs (job, last_run_at, last_ok_at, last_error) VALUES (?, ?, ?, NULL)').run(job.name, at, at);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[job ${job.name}] ${msg}`);
    db.prepare(
      'INSERT INTO job_runs (job, last_run_at, last_ok_at, last_error) VALUES (?, ?, NULL, ?) ON CONFLICT(job) DO UPDATE SET last_run_at = excluded.last_run_at, last_error = excluded.last_error',
    ).run(job.name, at, msg.slice(0, 300));
  } finally {
    running.delete(job.name);
  }
}

export function tick() {
  for (const job of JOBS) {
    if (job.enabled() && Date.now() - lastRun(job.name) >= job.everyMs()) void runJob(job);
  }
}

let timer: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (timer) return;
  setTimeout(tick, 2_000);
  timer = setInterval(tick, 15_000);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Called when a user opens their watchlist: refresh its quotes if older than a minute, and fetch filings in the background. */
export async function refreshWatchlistNow(userId: number) {
  const list = watchlistTickers(userId);
  if (!list.length) return;
  const cfg = p();
  const quotes = getQuotes(list);
  const old = list.filter((t) => {
    const q = quotes.get(t);
    return !q?.asOf || Date.now() - Date.parse(q.asOf) > MIN;
  });
  if (old.length && (cfg.alpaca || (cfg.eodhd && old.length <= 3))) await refreshQuotes(old).catch(() => undefined);
  if (cfg.alpaca) void ensureBars(list).catch(() => undefined);
  if (cfg.edgar) {
    const job = JOBS.find((j) => j.name === 'watchlist-filings')!;
    void runJob(job);
  }
}
