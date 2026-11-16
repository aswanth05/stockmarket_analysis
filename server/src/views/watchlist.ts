import type { SearchResult, WatchlistItem } from '@ust/shared';
import { getDb, nowIso } from '../db';
import { factsStatus } from '../fundamentals/service';
import { getQuotes } from '../quotes/service';
import { getCompany } from '../universe';
import { emptyQuote, watchlistTickers } from './common';

export const MAX_WATCHLIST = 100;

export function watchlistView(userId: number): WatchlistItem[] {
  const rows = getDb()
    .prepare(
      `SELECT w.ticker, w.added_at, c.name, c.sector, c.cik,
              EXISTS (SELECT 1 FROM ai_reviews a WHERE a.ticker = w.ticker AND a.status = 'complete') AS has_review
       FROM watchlist w LEFT JOIN companies c ON c.ticker = w.ticker WHERE w.user_id = ? ORDER BY w.added_at`,
    )
    .all(userId) as { ticker: string; added_at: string; name: string | null; sector: string | null; cik: string | null; has_review: number }[];
  const quotes = getQuotes(rows.map((r) => r.ticker));
  return rows.map((r) => ({
    ticker: r.ticker,
    name: r.name ?? r.ticker,
    sector: r.sector,
    addedAt: r.added_at,
    quote: quotes.get(r.ticker) ?? emptyQuote(r.ticker),
    researchStatus: r.has_review ? 'AI review available' : r.cik && factsStatus(r.cik)?.status === 'ok' ? 'fundamentals loaded' : 'not researched',
  }));
}

export function addToWatchlist(userId: number, ticker: string): 'ok' | 'unknown' | 'full' | 'exists' {
  if (!getCompany(ticker)) return 'unknown';
  const list = watchlistTickers(userId);
  if (list.includes(ticker)) return 'exists';
  if (list.length >= MAX_WATCHLIST) return 'full';
  getDb().prepare('INSERT INTO watchlist (user_id, ticker, added_at) VALUES (?, ?, ?)').run(userId, ticker, nowIso());
  return 'ok';
}

export function removeFromWatchlist(userId: number, ticker: string): boolean {
  return getDb().prepare('DELETE FROM watchlist WHERE user_id = ? AND ticker = ?').run(userId, ticker).changes > 0;
}

/** Ticker prefix or company-name match across stored NYSE/Nasdaq companies, S&P 500 first. */
export function search(q: string, limit = 10): SearchResult[] {
  const term = q.trim();
  if (!term) return [];
  return getDb()
    .prepare(
      `SELECT ticker, name, exchange FROM companies
       WHERE (ticker LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\')
         AND (in_sp500 = 1 OR is_etf = 1 OR exchange IN ('NYSE', 'Nasdaq'))
       ORDER BY (ticker = ?) DESC, in_sp500 DESC, is_etf DESC, (ticker LIKE ? ESCAPE '\\') DESC, length(ticker), ticker
       LIMIT ?`,
    )
    .all(`${esc(term.toUpperCase())}%`, `%${esc(term)}%`, term.toUpperCase(), `${esc(term.toUpperCase())}%`, limit) as unknown as SearchResult[];
}

const esc = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
