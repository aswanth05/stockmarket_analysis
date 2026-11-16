import type { Freshness, MarketStatus } from './market';

/** Where a number came from. Every displayed figure carries one. */
export interface SourceRef {
  source: string;
  form?: string;
  /** SEC accession number (filing ID) */
  accn?: string;
  filed?: string;
  url?: string;
}

export interface QuoteView {
  ticker: string;
  /** null = no stored value. Never 0 as a stand-in. */
  price: number | null;
  prevClose: number | null;
  changePct: number | null;
  /** Time of the quote itself (ISO). */
  asOf: string | null;
  source: string | null;
  freshness: Freshness | null;
  delayMinutes?: number;
  /** Set when the last refresh failed; the price shown is the last good value. */
  lastError?: string | null;
}

export interface MarketStatusView {
  status: MarketStatus;
  etTime: string;
  etDate: string;
  holiday?: string;
  earlyClose?: string;
  lastCompletedTradingDay: string;
  calendarSource: string;
}

export interface ProvidersStatus {
  alpaca: boolean;
  eodhd: boolean;
  edgar: boolean;
  anthropic: boolean;
}

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SwingStats {
  lastClose: number | null;
  change20dPct: number | null;
  distFromMa50Pct: number | null;
  distFromMa200Pct: number | null;
  high52w: number | null;
  low52w: number | null;
  volumeVsAvg20: number | null;
}

export interface BarsResponse {
  ticker: string;
  bars: Bar[];
  ma50: (number | null)[];
  ma200: (number | null)[];
  source: string | null;
  lastBarDate: string | null;
  stats: SwingStats;
}

export interface MetricInput {
  label: string;
  value: number | null;
  unit: 'usd' | 'pct' | 'ratio';
  period?: string;
  ref?: SourceRef;
}

/** A calculated figure with everything needed to show how it was made. */
export interface MetricView {
  id: string;
  name: string;
  value: number | null;
  unit: 'usd' | 'pct' | 'ratio';
  /** Why value is null, e.g. "prior-year revenue is zero or negative". */
  reason?: string;
  formula: string;
  inputs: MetricInput[];
  period: string;
  version: string;
}

export interface AnnualRow {
  /** Fiscal period end (YYYY-MM-DD). */
  end: string;
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  equity: number | null;
  refs: Partial<Record<'revenue' | 'netIncome' | 'operatingCashFlow' | 'capex' | 'equity', SourceRef>>;
}

export interface FactorScore {
  id: string;
  name: string;
  weight: number;
  /** 0–100, or null when inputs are missing. */
  score: number | null;
  basis: string;
}

export interface RiskFlag {
  id: string;
  text: string;
  basis: string;
}

export interface AiReviewView {
  id: number;
  ticker: string;
  createdAt: string;
  evidenceDate: string;
  model: string;
  status: 'complete' | 'rejected' | 'failed';
  summary: string;
  points: string[];
  sources: SourceRef[];
}

export interface CompanyHeader {
  ticker: string;
  name: string;
  exchange: string | null;
  sector: string | null;
  subIndustry: string | null;
  cik: string | null;
  inSp500: boolean;
}

export interface ResearchResponse {
  company: CompanyHeader;
  quote: QuoteView;
  annual: AnnualRow[];
  metrics: MetricView[];
  factors: { scores: FactorScore[]; total: number | null; method: string; experimental: true };
  risks: RiskFlag[];
  filings: FilingView[];
  aiReview: AiReviewView | null;
  fundamentalsStatus: 'loaded' | 'not-configured' | 'not-found' | 'error';
  fundamentalsError?: string;
  sources: SourceRef[];
}

export interface FilingView {
  ticker: string;
  form: string;
  filed: string;
  reportDate: string | null;
  description: string;
  accn: string;
  url: string;
}

export interface MarketRow {
  ticker: string;
  name: string;
  sector: string | null;
  kind: 'Stock' | 'ETF';
  quote: QuoteView;
  trend: number[];
}

export interface HomeResponse {
  providers: ProvidersStatus;
  proxies: { ticker: string; label: string; quote: QuoteView; closes: { date: string; value: number }[] }[];
  breadth: { advancing: number; declining: number; unchanged: number; noData: number; listSize: number; asOf: string | null };
  above50: { pct: number | null; counted: number; listSize: number; asOf: string | null };
  sectorCounts: { sector: string; count: number }[];
  weekly: { weekEnding: string | null; previousWeekEnding: string | null; rows: { sector: string; thisWeek: number | null; lastWeek: number | null }[] };
  topMarkets: MarketRow[];
  watchlist: { count: number; withNewFiling: number };
  recentFilings: FilingView[];
  aiReview: AiReviewView | null;
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  sector: string | null;
  addedAt: string;
  quote: QuoteView;
  researchStatus: 'fundamentals loaded' | 'AI review available' | 'not researched';
}

export interface SearchResult {
  ticker: string;
  name: string;
  exchange: string | null;
}

export interface ScreenerFilters {
  sector?: string;
  minPrice?: number;
  maxPrice?: number;
  minChangePct?: number;
  maxChangePct?: number;
  aboveMa50?: boolean;
  minRevenueGrowth?: number;
  minNetMargin?: number;
}

export interface ScreenerRow {
  ticker: string;
  name: string;
  sector: string;
  quote: QuoteView;
  aboveMa50: boolean | null;
  revenueGrowth: number | null;
  netMargin: number | null;
  fundamentalsPeriod: string | null;
}

export interface ScreenerResponse {
  rows: ScreenerRow[];
  total: number;
  universe: string;
  fundamentalsNote: string;
}

export interface SectorsResponse {
  movement: { sector: string; companies: number; change1d: number | null; change1w: number | null; change1m: number | null; withData: number }[];
  outlook: { sector: string; companies: number; withData: number; medianRevenueGrowth: number | null; medianNetMargin: number | null; period: string | null }[];
  movementAsOf: string | null;
  outlookSource: string;
}

export interface MethodologyResponse {
  metrics: { id: string; name: string; formula: string; inputs: string[]; notes: string; version: string }[];
  factors: { id: string; name: string; weight: number; basis: string }[];
  sources: { id: string; name: string; use: string; configured: boolean; lastSuccess: string | null; lastError: string | null; freshness: string }[];
  universe: { name: string; source: string; retrievedAt: string; size: number };
  calendar: { source: string; retrievedAt: string };
}

export interface SessionUser {
  id: number;
  email: string;
  createdAt: string;
}

export interface MarketStatusResponse extends MarketStatusView {
  providers: ProvidersStatus;
}

export interface AiUsageView {
  monthSpendUsd: number;
  monthlyBudgetUsd: number | null;
  remainingUsd: number | null;
}

export type { Freshness, MarketStatus };
