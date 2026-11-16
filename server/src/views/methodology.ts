import type { MethodologyResponse } from '@ust/shared';
import { FACTORS, METRICS, VERSION } from '../calculations/definitions/v1';
import { providersConfigured } from '../config';
import { CALENDAR } from '../market/calendar';
import { lastProviderEvents } from '../providers/http';
import { SP500 } from '../universe';

export function methodologyView(): MethodologyResponse {
  const p = providersConfigured();
  const src = (id: keyof typeof p, name: string, use: string, freshness: string) => ({ id, name, use, configured: p[id], freshness, ...lastProviderEvents(id) });
  return {
    metrics: Object.values(METRICS).map((m) => ({ id: m.id, name: m.name, formula: m.formula, inputs: [...m.inputs], notes: m.notes, version: VERSION })),
    factors: FACTORS.map((f) => ({ id: f.id, name: f.name, weight: f.weight, basis: f.basis })),
    sources: [
      src('alpaca', 'Alpaca Market Data', 'Live quotes (IEX exchange only on the free plan) and daily price history', 'Real-time for the IEX exchange only; not a consolidated feed'),
      src('eodhd', 'EODHD', 'Fallback quotes and end-of-day history', 'Delayed 15–20 minutes'),
      src('edgar', 'SEC EDGAR', 'Company filings, annual financial data (XBRL), exchange listings', 'As filed; updated daily'),
      src('anthropic', 'Anthropic Claude', 'AI review text written from stored evidence (optional)', 'Each review shows its evidence date'),
    ],
    universe: { name: 'S&P 500 constituents', source: SP500.source, retrievedAt: SP500.retrievedAt, size: SP500.companies.length },
    calendar: { source: CALENDAR.source, retrievedAt: CALENDAR.retrievedAt },
  };
}
