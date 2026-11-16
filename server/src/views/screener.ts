import type { ScreenerFilters, ScreenerResponse, SectorsResponse } from '@ust/shared';
import { recentCloses } from '../bars/service';
import { mean, median, pctChange } from '../calculations/engine';
import { bulkFundamentals } from '../fundamentals/service';
import { getQuotes } from '../quotes/service';
import { aboveMa50, emptyQuote, latestAsOf, sp500Rows } from './common';

const num = (v: unknown) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function parseFilters(q: Record<string, unknown>): ScreenerFilters {
  return {
    sector: typeof q.sector === 'string' && q.sector ? q.sector : undefined,
    minPrice: num(q.minPrice),
    maxPrice: num(q.maxPrice),
    minChangePct: num(q.minChangePct),
    maxChangePct: num(q.maxChangePct),
    aboveMa50: q.aboveMa50 === 'true' ? true : q.aboveMa50 === 'false' ? false : undefined,
    minRevenueGrowth: num(q.minRevenueGrowth),
    minNetMargin: num(q.minNetMargin),
  };
}

/**
 * A row passes a filter only when it has the data to test it: a company with no price
 * never matches a price filter (missing data is never treated as zero).
 */
export function screen(f: ScreenerFilters): ScreenerResponse {
  const sp = sp500Rows().filter((r) => !f.sector || r.sector === f.sector);
  const tickers = sp.map((r) => r.ticker);
  const quotes = getQuotes(tickers);
  const ma = aboveMa50(tickers);
  const fund = bulkFundamentals();
  const rows = sp
    .map((r) => {
      const fd = fund.get(r.cik);
      return {
        ticker: r.ticker,
        name: r.name,
        sector: r.sector,
        quote: quotes.get(r.ticker) ?? emptyQuote(r.ticker),
        aboveMa50: ma.get(r.ticker) ?? null,
        revenueGrowth: fd?.revenueGrowth ?? null,
        netMargin: fd?.netMargin ?? null,
        fundamentalsPeriod: fd?.period ?? null,
      };
    })
    .filter((r) => {
      const p = r.quote.price;
      const c = r.quote.changePct;
      if (f.minPrice !== undefined && (p == null || p < f.minPrice)) return false;
      if (f.maxPrice !== undefined && (p == null || p > f.maxPrice)) return false;
      if (f.minChangePct !== undefined && (c == null || c < f.minChangePct)) return false;
      if (f.maxChangePct !== undefined && (c == null || c > f.maxChangePct)) return false;
      if (f.aboveMa50 !== undefined && (r.aboveMa50 == null || r.aboveMa50 !== f.aboveMa50)) return false;
      if (f.minRevenueGrowth !== undefined && (r.revenueGrowth == null || r.revenueGrowth * 100 < f.minRevenueGrowth)) return false;
      if (f.minNetMargin !== undefined && (r.netMargin == null || r.netMargin * 100 < f.minNetMargin)) return false;
      return true;
    });
  const period = [...fund.values()].find((x) => x.period)?.period ?? null;
  return {
    rows,
    total: sp.length,
    universe: 'Saved S&P 500 list',
    fundamentalsNote: period
      ? `Revenue growth and net margin use SEC EDGAR calendar-year data (${period}). Companies without that data never pass those filters.`
      : 'Fundamentals filters need SEC EDGAR data, which has not been loaded yet.',
  };
}

export function sectorsView(): SectorsResponse {
  const sp = sp500Rows();
  const tickers = sp.map((r) => r.ticker);
  const quotes = getQuotes(tickers);
  const closes = recentCloses(tickers, 22);
  const fund = bulkFundamentals();
  const groups = new Map<string, typeof sp>();
  for (const r of sp) groups.set(r.sector, [...(groups.get(r.sector) ?? []), r]);
  const r2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
  const movement = [...groups.entries()].map(([sector, list]) => {
    const d1 = list.map((r) => quotes.get(r.ticker)?.changePct ?? null);
    const back = (n: number) =>
      list.map((r) => {
        const c = closes.get(r.ticker) ?? [];
        return c.length > n ? pctChange(c.at(-1)!.close, c.at(-1 - n)!.close) : null;
      });
    return {
      sector,
      companies: list.length,
      withData: d1.filter((v) => v != null).length,
      change1d: r2(mean(d1)),
      change1w: r2(mean(back(5))),
      change1m: r2(mean(back(21))),
    };
  });
  const outlook = [...groups.entries()].map(([sector, list]) => {
    const f = list.map((r) => fund.get(r.cik)).filter((x) => x != null);
    const g = median(f.map((x) => x.revenueGrowth));
    const m = median(f.map((x) => x.netMargin));
    return {
      sector,
      companies: list.length,
      withData: f.filter((x) => x.revenueGrowth != null).length,
      medianRevenueGrowth: g == null ? null : Math.round(g * 1000) / 10,
      medianNetMargin: m == null ? null : Math.round(m * 1000) / 10,
      period: f.find((x) => x.period)?.period ?? null,
    };
  });
  const by = (a: { sector: string }, b: { sector: string }) => a.sector.localeCompare(b.sector);
  return {
    movement: movement.sort(by),
    outlook: outlook.sort(by),
    movementAsOf: latestAsOf(quotes.values()),
    outlookSource: 'SEC EDGAR XBRL frames: annual revenue and net income per company, calendar-year aligned. Medians are across companies with data.',
  };
}
