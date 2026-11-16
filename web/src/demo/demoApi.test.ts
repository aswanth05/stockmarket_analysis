import { describe, expect, it } from 'vitest';
import { findBannedWording, type HomeResponse, type ResearchResponse, type ScreenerResponse } from '@ust/shared';
import { DEMO_SOURCE, demoCall } from './demoApi';

describe('demo data source (GitHub Pages build)', () => {
  it('labels every quote as sample data', async () => {
    const h = await demoCall<HomeResponse>('GET', '/home');
    for (const r of h.topMarkets) expect(r.quote.source).toBe(DEMO_SOURCE);
    expect(h.breadth.advancing + h.breadth.declining + h.breadth.unchanged).toBe(h.breadth.listSize);
  });

  it('is deterministic for a ticker', async () => {
    const a = await demoCall<{ bars: { close: number }[] }>('GET', '/bars/AAPL?days=50');
    const b = await demoCall<{ bars: { close: number }[] }>('GET', '/bars/AAPL?days=50');
    expect(a.bars).toEqual(b.bars);
  });

  it('runs the real calculations and says the financials are not SEC data', async () => {
    const r = await demoCall<ResearchResponse>('GET', '/research/MSFT');
    expect(r.metrics.map((m) => m.id)).toEqual(['revenueGrowth', 'netMargin', 'roe', 'freeCashFlow']);
    expect(r.metrics[0]!.inputs[0]!.ref?.source).toMatch(/not from SEC filings/);
    expect(r.filings).toEqual([]);
  });

  it('applies screener filters to the sample rows', async () => {
    const r = await demoCall<ScreenerResponse>('GET', '/screener?sector=Energy&minPrice=100');
    expect(r.rows.every((x) => x.sector === 'Energy' && (x.quote.price ?? 0) >= 100)).toBe(true);
  });

  it('keeps AI reviews off and has no recommendation wording', async () => {
    await expect(demoCall('POST', '/research/AAPL/ai-review')).rejects.toMatchObject({ status: 409 });
    const text = JSON.stringify(await demoCall('GET', '/home')) + JSON.stringify(await demoCall('GET', '/research/AAPL'));
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
