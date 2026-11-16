/**
 * Calculation definitions, version 1. Changing a formula means adding v2, not editing this file,
 * so every displayed figure can say which definition produced it.
 */
export const VERSION = 'v1';

export const METRICS = {
  revenueGrowth: {
    id: 'revenueGrowth',
    name: 'Revenue growth',
    formula: '(Revenue this year − Revenue prior year) ÷ Revenue prior year',
    inputs: ['Revenue, latest fiscal year', 'Revenue, prior fiscal year'],
    notes: 'Not calculated when prior-year revenue is zero or negative.',
  },
  netMargin: {
    id: 'netMargin',
    name: 'Net profit margin',
    formula: 'Net income ÷ Revenue',
    inputs: ['Net income, latest fiscal year', 'Revenue, latest fiscal year'],
    notes: 'Not calculated when revenue is zero or negative. Net income can be negative (a loss).',
  },
  roe: {
    id: 'roe',
    name: 'Return on equity',
    formula: 'Net income ÷ Average shareholders’ equity (start and end of year)',
    inputs: ['Net income, latest fiscal year', 'Equity at end of prior year', 'Equity at end of latest year'],
    notes: 'Not calculated when average equity is zero or negative: a ratio on negative equity has no meaning.',
  },
  freeCashFlow: {
    id: 'freeCashFlow',
    name: 'Free cash flow',
    formula: 'Operating cash flow − Capital expenditures',
    inputs: ['Net cash from operating activities', 'Payments to acquire property, plant and equipment'],
    notes: 'Capital expenditures are reported as a positive payment and subtracted.',
  },
} as const;

export type MetricId = keyof typeof METRICS;

/**
 * Experimental factor score (CLAUDE.md: any score is experimental until tested).
 * Each factor maps a metric to 0–100 on a fixed, disclosed scale; the total is the weighted mean
 * of the factors that have data, and is null if fewer than 3 factors have data.
 */
export const FACTORS = [
  { id: 'growth', name: 'Growth', weight: 0.25, metric: 'revenueGrowth', basis: 'Revenue growth: −10% → 0, +30% → 100, linear', lo: -0.1, hi: 0.3 },
  { id: 'profitability', name: 'Profitability', weight: 0.25, metric: 'netMargin', basis: 'Net margin: 0% → 0, 30% → 100, linear', lo: 0, hi: 0.3 },
  { id: 'returns', name: 'Returns on equity', weight: 0.25, metric: 'roe', basis: 'ROE: 0% → 0, 30% → 100, linear', lo: 0, hi: 0.3 },
  { id: 'cash', name: 'Cash generation', weight: 0.25, metric: 'fcfMargin', basis: 'Free cash flow ÷ revenue: 0% → 0, 25% → 100, linear', lo: 0, hi: 0.25 },
] as const;

export const FACTOR_METHOD = 'Factor score v1: equal weights, linear scales shown per factor. Experimental, not tested.';
