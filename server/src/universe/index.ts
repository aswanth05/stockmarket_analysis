import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from '../config';
import { getDb, nowIso } from '../db';

export interface Sp500File {
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  companies: { ticker: string; name: string; sector: string; subIndustry: string; cik: string }[];
}

export const SP500: Sp500File = JSON.parse(readFileSync(resolve(config.serverDir, 'data/sp500.json'), 'utf8'));

/** Index ETF proxies (UI_DESIGN §3). Always labelled as proxies, never as the index itself. */
export const INDEX_PROXIES = [
  { ticker: 'SPY', label: 'S&P 500', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE Arca' },
  { ticker: 'DIA', label: 'Dow Jones', name: 'SPDR Dow Jones Industrial Average ETF', exchange: 'NYSE Arca' },
  { ticker: 'QQQ', label: 'Nasdaq', name: 'Invesco QQQ Trust', exchange: 'Nasdaq' },
] as const;

export const PROXY_TICKERS = INDEX_PROXIES.map((p) => p.ticker);
export const SP500_TICKERS = SP500.companies.map((c) => c.ticker);

/** Insert or refresh the stored universe. Safe to run on every start. */
export function seedUniverse() {
  const db = getDb();
  const at = nowIso();
  const upsert = db.prepare(`
    INSERT INTO companies (ticker, name, cik, sector, sub_industry, in_sp500, is_etf, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ticker) DO UPDATE SET name = excluded.name, cik = COALESCE(excluded.cik, companies.cik),
      sector = COALESCE(excluded.sector, companies.sector), sub_industry = COALESCE(excluded.sub_industry, companies.sub_industry),
      in_sp500 = excluded.in_sp500, is_etf = excluded.is_etf, updated_at = excluded.updated_at`);
  db.exec('BEGIN');
  db.prepare('UPDATE companies SET in_sp500 = 0').run();
  for (const c of SP500.companies) upsert.run(c.ticker, c.name, c.cik, c.sector, c.subIndustry, 1, 0, at);
  for (const p of INDEX_PROXIES) {
    upsert.run(p.ticker, p.name, null, null, null, 0, 1, at);
    db.prepare('UPDATE companies SET exchange = ? WHERE ticker = ?').run(p.exchange, p.ticker);
  }
  db.exec('COMMIT');
}

export interface CompanyRow {
  ticker: string;
  name: string;
  cik: string | null;
  exchange: string | null;
  sector: string | null;
  sub_industry: string | null;
  in_sp500: number;
  is_etf: number;
}

export function getCompany(ticker: string): CompanyRow | undefined {
  return getDb().prepare('SELECT * FROM companies WHERE ticker = ?').get(ticker.toUpperCase()) as CompanyRow | undefined;
}

/** US tickers: letters, optional class suffix (BRK.B). Rejects anything else before it reaches a provider. */
export const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;
export const normalizeTicker = (t: string) => t.trim().toUpperCase();
