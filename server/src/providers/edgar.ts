import { secrets } from '../config';
import { fetchJson, ProviderError, sleep } from './http';

/**
 * SEC EDGAR. No key; the SEC requires a User-Agent with a contact name and email,
 * and at most 10 requests per second. Requests are queued at ~8 per second.
 */
const userAgent = () => {
  const ua = secrets.secUserAgent();
  if (!ua?.includes('@')) throw new ProviderError('edgar', 'SEC_EDGAR_USER_AGENT (name and email) is not configured');
  return ua;
};

let chain: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    try {
      return await fn();
    } finally {
      await sleep(125);
    }
  });
  chain = run.catch(() => undefined);
  return run;
}

const get = <T>(url: string, logPath: string) =>
  queued(() => fetchJson<T>(url, { provider: 'edgar', logPath, headers: { 'User-Agent': userAgent() }, timeoutMs: 30_000 }));

export const padCik = (cik: string | number) => String(cik).padStart(10, '0');

export function filingUrl(cik: string, accn: string, primaryDoc?: string | null) {
  const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accn.replace(/-/g, '')}`;
  return primaryDoc ? `${base}/${primaryDoc}` : `${base}/${accn}-index.htm`;
}

export const companyFilingsUrl = (cik: string) => `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padCik(cik)}&type=&dateb=&owner=include&count=40`;

export interface TickerRow {
  cik: string;
  name: string;
  ticker: string;
  exchange: string | null;
}

/** All SEC-registered tickers with their exchange. Used for search and exchange labels. */
export async function tickersWithExchange(): Promise<TickerRow[]> {
  const data = await get<{ fields: string[]; data: [number, string, string, string | null][] }>(
    'https://www.sec.gov/files/company_tickers_exchange.json',
    '/files/company_tickers_exchange.json',
  );
  return data.data.map(([cik, name, ticker, exchange]) => ({
    cik: padCik(cik),
    name,
    // EDGAR writes class shares as BRK-B; the app uses BRK.B.
    ticker: ticker.toUpperCase().replace('-', '.'),
    exchange,
  }));
}

export interface Submissions {
  name: string;
  exchanges: string[];
  tickers: string[];
  sicDescription?: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

export const submissions = (cik: string) =>
  get<Submissions>(`https://data.sec.gov/submissions/CIK${padCik(cik)}.json`, `/submissions/CIK${padCik(cik)}.json`);

export interface FactEntry {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
  frame?: string;
}

export interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: { 'us-gaap'?: Record<string, { label?: string; units: Record<string, FactEntry[]> }> };
}

export const companyFacts = (cik: string) =>
  get<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`, `/api/xbrl/companyfacts/CIK${padCik(cik)}.json`);

export interface FrameRow {
  accn: string;
  cik: number;
  entityName: string;
  start?: string;
  end: string;
  val: number;
}

/** One value per company for a concept and calendar period, e.g. ("Revenues", "CY2025"). */
export async function frame(tag: string, period: string): Promise<FrameRow[]> {
  try {
    const d = await get<{ data: FrameRow[] }>(
      `https://data.sec.gov/api/xbrl/frames/us-gaap/${tag}/USD/${period}.json`,
      `/api/xbrl/frames/us-gaap/${tag}/USD/${period}.json`,
    );
    return d.data;
  } catch (e) {
    // A tag with no data for that period returns 404; that is "no rows", not a failure.
    if (e instanceof ProviderError && e.status === 404) return [];
    throw e;
  }
}
