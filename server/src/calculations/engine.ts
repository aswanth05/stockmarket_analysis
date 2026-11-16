/**
 * All app calculations live here (CLAUDE.md: calculations run in backend code; AI never computes numbers).
 * Each returns { value, reason }: value is null with a reason whenever the math is undefined.
 */
export interface Result {
  value: number | null;
  reason?: string;
}

const missing = (what: string): Result => ({ value: null, reason: `${what} is not available` });
const ok = (value: number): Result => (Number.isFinite(value) ? { value } : { value: null, reason: 'result is not a finite number' });

export function revenueGrowth(current: number | null, prior: number | null): Result {
  if (current == null) return missing('latest revenue');
  if (prior == null) return missing('prior-year revenue');
  if (prior <= 0) return { value: null, reason: 'prior-year revenue is zero or negative' };
  return ok((current - prior) / prior);
}

export function netMargin(netIncome: number | null, revenue: number | null): Result {
  if (netIncome == null) return missing('net income');
  if (revenue == null) return missing('revenue');
  if (revenue <= 0) return { value: null, reason: 'revenue is zero or negative' };
  return ok(netIncome / revenue);
}

export function returnOnEquity(netIncome: number | null, equityStart: number | null, equityEnd: number | null): Result {
  if (netIncome == null) return missing('net income');
  if (equityEnd == null) return missing('year-end equity');
  // With no prior-year equity, fall back to year-end equity and say so.
  const avg = equityStart == null ? equityEnd : (equityStart + equityEnd) / 2;
  if (avg <= 0) return { value: null, reason: 'average shareholders’ equity is zero or negative' };
  const r = ok(netIncome / avg);
  return equityStart == null ? { ...r, reason: 'prior-year equity missing; used year-end equity only' } : r;
}

export function freeCashFlow(operatingCashFlow: number | null, capex: number | null): Result {
  if (operatingCashFlow == null) return missing('operating cash flow');
  if (capex == null) return missing('capital expenditures');
  return ok(operatingCashFlow - Math.abs(capex));
}

export function ratio(numerator: number | null, denominator: number | null, what: string): Result {
  if (numerator == null || denominator == null) return missing(what);
  if (denominator <= 0) return { value: null, reason: `${what}: denominator is zero or negative` };
  return ok(numerator / denominator);
}

export function pctChange(current: number | null, base: number | null): number | null {
  if (current == null || base == null || base <= 0) return null;
  const v = ((current - base) / base) * 100;
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

/** Simple moving average. null until `n` values exist; never a partial average. */
export function sma(values: number[], n: number): (number | null)[] {
  let sum = 0;
  return values.map((v, i) => {
    sum += v;
    if (i >= n) sum -= values[i - n]!;
    return i >= n - 1 ? Math.round((sum / n) * 10000) / 10000 : null;
  });
}

/** Map a value onto 0–100 between lo and hi, clamped. */
export function linearScore(value: number | null, lo: number, hi: number): number | null {
  if (value == null) return null;
  const s = ((value - lo) / (hi - lo)) * 100;
  return Math.round(Math.min(100, Math.max(0, s)));
}

export function median(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

export function mean(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
