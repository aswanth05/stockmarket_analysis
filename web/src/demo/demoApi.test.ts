import { beforeEach, describe, expect, it } from 'vitest';
import { findBannedWording, type AnnualRow, type HomeResponse, type ResearchResponse, type ScreenerResponse, type SectorsResponse } from '@ust/shared';
import { demoCall, NO_PRICES, setSnapshotForTests } from './demoApi';

const ref = { source: 'SEC EDGAR, Revenues', form: '10-K', accn: '0000789019-25-000073', filed: '2025-07-30' };
const row = (end: string, revenue: number, netIncome: number, equity: number): AnnualRow => ({
  end,
  revenue,
  netIncome,
  operatingCashFlow: netIncome * 1.3,
  capex: revenue * 0.1,
  freeCashFlow: netIncome * 1.3 - revenue * 0.1,
  equity,
  refs: { revenue: ref, netIncome: ref, operatingCashFlow: ref, capex: ref, equity: ref },
});

beforeEach(() => {
  setSnapshotForTests(
    {
      status: 'ok',
      generatedAt: '2026-11-15T06:00:00.000Z',
      period: 'CY2025 vs CY2024',
      companies: {
        MSFT: { exchange: 'Nasdaq', revenueGrowth: 0.15, netMargin: 0.36, period: 'CY2025 vs CY2024', hasAnnual: true },
        XOM: { exchange: 'NYSE', revenueGrowth: -0.05, netMargin: 0.09, period: 'CY2025 vs CY2024', hasAnnual: true },
        CVX: { exchange: 'NYSE', revenueGrowth: null, netMargin: null, period: 'CY2025 vs CY2024', error: 'edgar: HTTP 404' },
      },
    },
    {
      MSFT: {
        ticker: 'MSFT',
        exchange: 'Nasdaq',
        annual: [row('2025-06-30', 281.7e9, 101.8e9, 343.5e9), row('2024-06-30', 245.1e9, 88.1e9, 268.5e9)],
        priorEquity: { value: 268.5e9, end: '2024-06-30' },
        filings: [{ ticker: 'MSFT', form: '10-Q', filed: '2026-10-29', reportDate: '2026-09-30', description: 'Quarterly report', accn: '0000789019-26-000100', url: 'https://www.sec.gov/' }],
      },
    },
  );
});

describe('public demo data (real SEC snapshot, no prices)', () => {
  it('never shows a price: quotes are empty and say why', async () => {
    const h = await demoCall<HomeResponse>('GET', '/home');
    for (const r of h.topMarkets) {
      expect(r.quote.price).toBeNull();
      expect(r.quote.lastError).toBe(NO_PRICES);
    }
    expect(h.breadth.noData).toBe(h.breadth.listSize);
  });

  it('runs the real calculations on the SEC figures with their filing IDs', async () => {
    const r = await demoCall<ResearchResponse>('GET', '/research/MSFT');
    expect(r.fundamentalsStatus).toBe('loaded');
    const m = Object.fromEntries(r.metrics.map((x) => [x.id, x]));
    expect(m.revenueGrowth!.value).toBeCloseTo(281.7 / 245.1 - 1, 6);
    expect(m.netMargin!.inputs[0]!.ref?.accn).toBe('0000789019-25-000073');
    expect(r.company.exchange).toBe('Nasdaq');
    expect(r.filings).toHaveLength(1);
  });

  it('reports a company whose SEC download failed as an error, not as zeros', async () => {
    const r = await demoCall<ResearchResponse>('GET', '/research/CVX');
    expect(r.fundamentalsStatus).toBe('error');
    expect(r.metrics).toEqual([]);
  });

  it('screens on SEC fundamentals; price filters match nothing', async () => {
    const g = await demoCall<ScreenerResponse>('GET', '/screener?minRevenueGrowth=10');
    expect(g.rows.map((x) => x.ticker)).toEqual(['MSFT']);
    const p = await demoCall<ScreenerResponse>('GET', '/screener?minPrice=1');
    expect(p.rows).toEqual([]);
  });

  it('shows sector outlook from SEC data and no price movement', async () => {
    const s = await demoCall<SectorsResponse>('GET', '/sectors');
    const energy = s.outlook.find((o) => o.sector === 'Energy')!;
    expect(energy.withData).toBe(1);
    expect(energy.medianRevenueGrowth).toBe(-5);
    expect(s.movement.every((m) => m.change1d === null)).toBe(true);
  });

  it('shows watchlist filings from the snapshot', async () => {
    const h = await demoCall<HomeResponse>('GET', '/home');
    expect(h.recentFilings.map((f) => f.accn)).toContain('0000789019-26-000100');
  });

  it('keeps AI reviews off and has no recommendation wording', async () => {
    await expect(demoCall('POST', '/research/AAPL/ai-review')).rejects.toMatchObject({ status: 409 });
    const text = JSON.stringify(await demoCall('GET', '/home')) + JSON.stringify(await demoCall('GET', '/research/MSFT'));
    expect(findBannedWording(text)).toEqual([]);
  });

  it('adds and removes watchlist companies', async () => {
    const added = await demoCall<{ items: { ticker: string }[] }>('POST', '/watchlist', { ticker: 'jpm' });
    expect(added.items.map((i) => i.ticker)).toContain('JPM');
    const removed = await demoCall<{ items: { ticker: string }[] }>('DELETE', '/watchlist/JPM');
    expect(removed.items.map((i) => i.ticker)).not.toContain('JPM');
    await expect(demoCall('POST', '/watchlist', { ticker: 'ZZZZ' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('demo Home', () => {
  it('ranks companies by real SEC growth and margin, with no price fields', async () => {
    const { demoCall: call } = await import('./demoApi');
    const h = await call<import('./demoApi').DemoHomeResponse>('GET', '/demo-home');
    expect(h.status).toBe('ok');
    expect(h.topGrowth[0]!.ticker).toBe('MSFT');
    expect(h.topMargin.map((r) => r.ticker)).toEqual(['MSFT', 'XOM']);
    expect(h.growing).toBe(1);
    expect(h.shrinking).toBe(1);
    expect(JSON.stringify(h)).not.toMatch(/"price"/);
  });
});
