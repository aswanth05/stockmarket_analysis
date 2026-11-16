import type { ResearchResponse, SourceRef } from '@ust/shared';
import { barsResponse, ensureBars } from '../bars/service';
import { providersConfigured } from '../config';
import { latestReview, type Evidence } from '../ai/service';
import { annualRows, computeMetrics, factorScores, factsStatus, loadCompany, recentFilings, riskFlags } from '../fundamentals/service';
import { companyFilingsUrl, padCik } from '../providers/edgar';
import { getQuotes, refreshQuotes } from '../quotes/service';
import { getCompany, type CompanyRow } from '../universe';
import { emptyQuote } from './common';

const QUOTE_REFRESH_AFTER_MS = 60_000;

/** Pull anything missing for one company, without failing the page if a provider is down. */
export async function warmCompany(c: CompanyRow): Promise<{ fundamentalsError?: string }> {
  const p = providersConfigured();
  const q = getQuotes([c.ticker]).get(c.ticker);
  const tasks: Promise<unknown>[] = [];
  if ((p.alpaca || p.eodhd) && (!q?.asOf || Date.now() - Date.parse(q.asOf) > QUOTE_REFRESH_AFTER_MS)) tasks.push(refreshQuotes([c.ticker]));
  if (p.alpaca || p.eodhd) tasks.push(ensureBars([c.ticker]).catch(() => undefined));
  let fundamentalsError: string | undefined;
  if (p.edgar && c.cik && !c.is_etf) {
    tasks.push(
      loadCompany(c.cik).catch((e) => {
        fundamentalsError = e instanceof Error ? e.message : String(e);
      }),
    );
  }
  await Promise.all(tasks);
  return { fundamentalsError };
}

export function researchView(c: CompanyRow, fundamentalsError?: string): ResearchResponse {
  const p = providersConfigured();
  const quote = getQuotes([c.ticker]).get(c.ticker) ?? emptyQuote(c.ticker);
  const cik = c.cik ? padCik(c.cik) : null;
  const annual = cik ? annualRows(cik) : [];
  const metrics = cik ? computeMetrics(cik, annual) : [];
  const st = cik ? factsStatus(cik) : undefined;
  const fundamentalsStatus: ResearchResponse['fundamentalsStatus'] = annual.length
    ? 'loaded'
    : !p.edgar
      ? 'not-configured'
      : st?.status === 'error' || fundamentalsError
        ? 'error'
        : 'not-found';

  const sources: SourceRef[] = [];
  if (quote.source) sources.push({ source: `Quote: ${quote.source}${quote.asOf ? `, as of ${quote.asOf.slice(0, 16).replace('T', ' ')} UTC` : ''}` });
  const bars = barsResponse(c.ticker, 1);
  if (bars.source) sources.push({ source: `Daily prices: ${bars.source}${bars.lastBarDate ? `, last close ${bars.lastBarDate}` : ''}` });
  if (cik) sources.push({ source: 'SEC EDGAR filing list', url: companyFilingsUrl(cik) });
  const seen = new Set<string>();
  for (const r of annual.slice(0, 2)) {
    for (const ref of Object.values(r.refs)) {
      if (ref?.accn && !seen.has(ref.accn)) {
        seen.add(ref.accn);
        sources.push(ref);
      }
    }
  }

  return {
    company: {
      ticker: c.ticker,
      name: c.name,
      exchange: c.exchange,
      sector: c.sector,
      subIndustry: c.sub_industry,
      cik,
      inSp500: Boolean(c.in_sp500),
    },
    quote,
    annual,
    metrics,
    factors: factorScores(metrics, annual),
    risks: riskFlags(metrics, annual),
    filings: cik ? recentFilings(cik, c.ticker) : [],
    aiReview: latestReview(c.ticker),
    fundamentalsStatus,
    fundamentalsError: fundamentalsStatus === 'error' ? (fundamentalsError ?? st?.error ?? undefined) : undefined,
    sources,
  };
}

const fmtUsd = (v: number | null) => (v == null ? 'not available' : `$${(v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 })} million`);
const fmtPct = (v: number | null) => (v == null ? 'not available' : `${(v * 100).toFixed(1)}%`);

/** Evidence for an AI review: only stored, already-calculated facts, each with its period and source. */
export function buildEvidence(c: CompanyRow): Evidence {
  const r = researchView(c);
  const facts: string[] = [];
  const dates: string[] = [];
  for (const m of r.metrics) {
    const v = m.unit === 'pct' ? fmtPct(m.value) : fmtUsd(m.value);
    facts.push(`${m.name}: ${v}${m.reason ? ` (${m.reason})` : ''}; ${m.period}; formula ${m.formula}; source SEC EDGAR 10-K data.`);
  }
  for (const a of r.annual.slice(0, 3)) {
    facts.push(`Fiscal year ending ${a.end}: revenue ${fmtUsd(a.revenue)}, net income ${fmtUsd(a.netIncome)}, free cash flow ${fmtUsd(a.freeCashFlow)}; source SEC EDGAR.`);
    dates.push(a.end);
  }
  for (const f of r.risks) facts.push(`Flag raised by app rule "${f.basis}": ${f.text}`);
  const b = barsResponse(c.ticker);
  const s = b.stats;
  if (b.lastBarDate && s.lastClose != null) {
    facts.push(
      `Price as of close ${b.lastBarDate}: $${s.lastClose.toFixed(2)}; 20-day change ${s.change20dPct ?? 'n/a'}%; distance from 50-day average ${s.distFromMa50Pct ?? 'n/a'}%; from 200-day average ${s.distFromMa200Pct ?? 'n/a'}%; source ${b.source}.`,
    );
    dates.push(b.lastBarDate);
  }
  for (const f of r.filings.slice(0, 5)) {
    facts.push(`Filing: ${f.form} filed ${f.filed} (${f.description}).`);
    dates.push(f.filed);
  }
  return {
    ticker: c.ticker,
    companyName: c.name,
    sector: c.sector,
    evidenceDate: dates.sort().at(-1) ?? new Date().toISOString().slice(0, 10),
    facts,
    sources: r.sources,
  };
}

export { getCompany };
