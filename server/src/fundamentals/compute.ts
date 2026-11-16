/**
 * Pure fundamentals logic (no database), shared by the server and the browser demo build.
 */
import type { AnnualRow, FactorScore, MetricInput, MetricView, RiskFlag, SourceRef } from '@ust/shared';
import { freeCashFlow, linearScore, netMargin, ratio, returnOnEquity, revenueGrowth, type Result } from '../calculations/engine';
import { FACTORS, FACTOR_METHOD, METRICS, VERSION } from '../calculations/definitions/v1';

export const fyLabel = (end: string) => `FY ending ${end}`;

export interface PriorEquity {
  value: number;
  end: string;
  ref?: SourceRef;
}

function metric(def: (typeof METRICS)[keyof typeof METRICS], r: Result, unit: MetricView['unit'], inputs: MetricInput[], period: string): MetricView {
  return { id: def.id, name: def.name, value: r.value, unit, reason: r.reason, formula: def.formula, inputs, period, version: VERSION };
}

/** Latest-year metrics from annual rows (newest first). */
export function buildMetrics(rows: AnnualRow[], prevEq: PriorEquity | undefined): MetricView[] {
  const [cur, prev] = rows;
  if (!cur) return [];
  const period = fyLabel(cur.end);
  const inp = (label: string, value: number | null, unit: MetricInput['unit'], p: string, ref?: SourceRef): MetricInput => ({ label, value, unit, period: p, ref });
  const fcf = freeCashFlow(cur.operatingCashFlow, cur.capex);
  return [
    metric(METRICS.revenueGrowth, revenueGrowth(cur.revenue, prev?.revenue ?? null), 'pct', [
      inp('Revenue', cur.revenue, 'usd', period, cur.refs.revenue),
      inp('Revenue, prior year', prev?.revenue ?? null, 'usd', prev ? fyLabel(prev.end) : 'prior year not available', prev?.refs.revenue),
    ], `${period} vs ${prev ? fyLabel(prev.end) : 'prior year'}`),
    metric(METRICS.netMargin, netMargin(cur.netIncome, cur.revenue), 'pct', [
      inp('Net income', cur.netIncome, 'usd', period, cur.refs.netIncome),
      inp('Revenue', cur.revenue, 'usd', period, cur.refs.revenue),
    ], period),
    metric(METRICS.roe, returnOnEquity(cur.netIncome, prevEq?.value ?? null, cur.equity), 'pct', [
      inp('Net income', cur.netIncome, 'usd', period, cur.refs.netIncome),
      inp('Equity, start of year', prevEq?.value ?? null, 'usd', prevEq ? `as of ${prevEq.end}` : 'not available', prevEq?.ref),
      inp('Equity, end of year', cur.equity, 'usd', `as of ${cur.end}`, cur.refs.equity),
    ], period),
    metric(METRICS.freeCashFlow, fcf, 'usd', [
      inp('Operating cash flow', cur.operatingCashFlow, 'usd', period, cur.refs.operatingCashFlow),
      inp('Capital expenditures', cur.capex, 'usd', period, cur.refs.capex),
    ], period),
  ];
}

export function factorScores(metrics: MetricView[], rows: AnnualRow[]) {
  const val = (id: string) => metrics.find((m) => m.id === id)?.value ?? null;
  const cur = rows[0];
  const fcfMargin = cur ? ratio(cur.freeCashFlow, cur.revenue, 'free cash flow margin').value : null;
  const values: Record<string, number | null> = {
    revenueGrowth: val('revenueGrowth'),
    netMargin: val('netMargin'),
    roe: val('roe'),
    fcfMargin,
  };
  const scores: FactorScore[] = FACTORS.map((f) => ({
    id: f.id,
    name: f.name,
    weight: f.weight,
    score: linearScore(values[f.metric] ?? null, f.lo, f.hi),
    basis: f.basis,
  }));
  const have = scores.filter((s) => s.score != null);
  const wsum = have.reduce((a, s) => a + s.weight, 0);
  const total = have.length >= 3 ? Math.round(have.reduce((a, s) => a + s.score! * s.weight, 0) / wsum) : null;
  return { scores, total, method: FACTOR_METHOD, experimental: true as const };
}

/** Rule-based flags from stored figures. Each states the rule that raised it. */
export function riskFlags(metrics: MetricView[], rows: AnnualRow[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const [cur, prev] = rows;
  const v = (id: string) => metrics.find((m) => m.id === id)?.value ?? null;
  if (!cur) return flags;
  if ((v('revenueGrowth') ?? 0) < 0) flags.push({ id: 'revenue-decline', text: 'Revenue fell compared with the prior year.', basis: 'Revenue growth below 0%' });
  if (cur.netIncome != null && cur.netIncome < 0) flags.push({ id: 'net-loss', text: 'The company reported a net loss.', basis: 'Net income below 0' });
  if (cur.freeCashFlow != null && cur.freeCashFlow < 0) flags.push({ id: 'negative-fcf', text: 'Free cash flow was negative.', basis: 'Operating cash flow minus capital expenditures below 0' });
  if (cur.equity != null && cur.equity <= 0) flags.push({ id: 'negative-equity', text: 'Shareholders’ equity is zero or negative.', basis: 'Year-end equity at or below 0' });
  if (prev && cur.netIncome != null && prev.netIncome != null && prev.netIncome > 0 && cur.netIncome < prev.netIncome * 0.75)
    flags.push({ id: 'profit-drop', text: 'Net income fell by more than 25%.', basis: 'Net income below 75% of prior year' });
  if (rows.length < 2) flags.push({ id: 'short-history', text: 'Less than two years of annual data are stored.', basis: 'Fewer than 2 fiscal years' });
  return flags;
}
