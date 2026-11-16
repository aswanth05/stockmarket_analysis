import type { AnnualRow, SourceRef } from '@ust/shared';
import { freeCashFlow } from '../calculations/engine';
import { filingUrl } from '../providers/edgar';
import type { PriorEquity } from './compute';
import type { Concept } from './extract';

/** One stored annual value (same shape as a `facts` table row). */
export interface FactRow {
  concept: Concept;
  period_end: string;
  period_start: string | null;
  value: number;
  tag: string;
  accn: string;
  form: string;
  filed: string;
}

export const refOf = (cik: string, f: FactRow | undefined): SourceRef | undefined =>
  f && { source: `SEC EDGAR, ${f.tag}`, form: f.form, accn: f.accn, filed: f.filed, url: filingUrl(cik, f.accn) };

/** Annual rows (newest first, up to 6 fiscal years) from stored facts. */
export function rowsFromFacts(cik: string, facts: FactRow[]): AnnualRow[] {
  const by = (c: Concept) => new Map(facts.filter((r) => r.concept === c).map((r) => [r.period_end, r]));
  const rev = by('revenue');
  const ni = by('netIncome');
  const cfo = by('operatingCashFlow');
  const capex = by('capex');
  const eq = by('equity');
  const ends = [...new Set([...rev.keys(), ...ni.keys()])].sort().reverse().slice(0, 6);
  return ends.map((end) => ({
    end,
    revenue: rev.get(end)?.value ?? null,
    netIncome: ni.get(end)?.value ?? null,
    operatingCashFlow: cfo.get(end)?.value ?? null,
    capex: capex.get(end)?.value ?? null,
    freeCashFlow: freeCashFlow(cfo.get(end)?.value ?? null, capex.get(end)?.value ?? null).value,
    equity: eq.get(end)?.value ?? null,
    refs: {
      revenue: refOf(cik, rev.get(end)),
      netIncome: refOf(cik, ni.get(end)),
      operatingCashFlow: refOf(cik, cfo.get(end)),
      capex: refOf(cik, capex.get(end)),
      equity: refOf(cik, eq.get(end)),
    },
  }));
}

/** Equity at the fiscal-year end before `end` (start-of-year equity for ROE). */
export function priorEquityFromFacts(cik: string, facts: FactRow[], end: string): PriorEquity | undefined {
  const f = facts
    .filter((r) => r.concept === 'equity' && r.period_end < end)
    .sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
  return f && { value: f.value, end: f.period_end, ref: refOf(cik, f) };
}
