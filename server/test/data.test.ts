import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getDb } from '../src/db';
import { extractAnnual } from '../src/fundamentals/extract';
import { annualRows, computeMetrics } from '../src/fundamentals/service';
import type { CompanyFacts } from '../src/providers/edgar';
import { getQuotes, markFailed, saveQuotesForTests } from '../src/quotes/service';
import { screen } from '../src/views/screener';
import { freshApp, H, loggedIn, noProviders } from './helpers';

beforeEach(noProviders);

const quote = (ticker: string, price: number, prevClose: number, asOf = '2026-11-13T20:59:00Z') => ({
  ticker,
  price,
  prevClose,
  asOf,
  source: 'Alpaca (IEX)',
  freshness: 'real-time' as const,
});

describe('watchlist (step 34)', () => {
  it('persists on the server across logout and login', async () => {
    const { app, agent } = await loggedIn();
    await agent.post('/api/watchlist').set(H).send({ ticker: 'aapl' }).expect(201);
    await agent.post('/api/watchlist').set(H).send({ ticker: 'MSFT' }).expect(201);
    await agent.post('/api/auth/logout').set(H).expect(200);
    const again = request.agent(app);
    await again.post('/api/auth/login').set(H).send({ email: 'owner@example.com', password: 'correct horse 42' }).expect(200);
    const r = await again.get('/api/watchlist').expect(200);
    expect(r.body.items.map((i: { ticker: string }) => i.ticker)).toEqual(['AAPL', 'MSFT']);
  });

  it('is private to each account', async () => {
    const { app, agent } = await loggedIn();
    await agent.post('/api/watchlist').set(H).send({ ticker: 'AAPL' }).expect(201);
    process.env.ALLOW_SIGNUP = 'true';
    const other = request.agent(app);
    await other.post('/api/auth/signup').set(H).send({ email: 'other@example.com', password: 'another pass 77' }).expect(201);
    const r = await other.get('/api/watchlist').expect(200);
    expect(r.body.items).toEqual([]);
  });

  it('rejects unknown and malformed tickers', async () => {
    const { agent } = await loggedIn();
    await agent.post('/api/watchlist').set(H).send({ ticker: 'ZZZZZ' }).expect(404);
    await agent.post('/api/watchlist').set(H).send({ ticker: "'; DROP" }).expect(400);
  });

  it('removes a company', async () => {
    const { agent } = await loggedIn();
    await agent.post('/api/watchlist').set(H).send({ ticker: 'AAPL' }).expect(201);
    const r = await agent.delete('/api/watchlist/AAPL').set(H).expect(200);
    expect(r.body.items).toEqual([]);
  });
});

describe('quote storage and stale states (step 32)', () => {
  it('stores each quote with its time and computes change in the backend', () => {
    freshApp();
    saveQuotesForTests([quote('AAPL', 105, 100)]);
    const q = getQuotes(['AAPL'], new Date('2026-11-14T15:00:00Z')).get('AAPL')!;
    expect(q).toMatchObject({ price: 105, changePct: 5, asOf: '2026-11-13T20:59:00Z', source: 'Alpaca (IEX)', freshness: 'real-time' });
  });

  it('keeps the last value and marks it stale when a refresh fails', () => {
    freshApp();
    saveQuotesForTests([quote('AAPL', 105, 100)]);
    markFailed(['AAPL'], 'alpaca: HTTP 503');
    const q = getQuotes(['AAPL'], new Date('2026-11-14T15:00:00Z')).get('AAPL')!;
    expect(q.price).toBe(105);
    expect(q.freshness).toBe('stale');
    expect(q.asOf).toBe('2026-11-13T20:59:00Z');
    expect(q.lastError).toMatch(/503/);
  });

  it('marks a quote stale when it is too old during the open session', () => {
    freshApp();
    saveQuotesForTests([quote('AAPL', 105, 100, '2026-11-13T15:00:00Z')]);
    expect(getQuotes(['AAPL'], new Date('2026-11-13T15:10:00Z')).get('AAPL')!.freshness).toBe('real-time');
    expect(getQuotes(['AAPL'], new Date('2026-11-13T16:00:00Z')).get('AAPL')!.freshness).toBe('stale');
  });

  it('returns nulls, never zero, when there is no quote', () => {
    freshApp();
    expect(getQuotes(['MSFT']).get('MSFT')).toMatchObject({ price: null, changePct: null, asOf: null, freshness: null });
  });
});

/** A trimmed company-facts file shaped like EDGAR's, with values as filed. */
const FACTS: CompanyFacts = {
  cik: 320193,
  entityName: 'Example Co',
  facts: {
    'us-gaap': {
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: {
          USD: [
            { start: '2024-09-29', end: '2025-09-27', val: 416_161_000_000, accn: '0000320193-25-000079', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31' },
            { start: '2023-10-01', end: '2024-09-28', val: 391_035_000_000, accn: '0000320193-25-000079', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31' },
            { start: '2023-10-01', end: '2024-09-28', val: 391_035_000_000, accn: '0000320193-24-000123', fy: 2024, fp: 'FY', form: '10-K', filed: '2024-11-01' },
            // A quarter inside a 10-K must be ignored.
            { start: '2025-06-29', end: '2025-09-27', val: 102_466_000_000, accn: '0000320193-25-000079', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31' },
            // A 10-Q value must be ignored.
            { start: '2024-09-29', end: '2025-06-28', val: 313_695_000_000, accn: '0000320193-25-000073', fy: 2025, fp: 'Q3', form: '10-Q', filed: '2025-08-01' },
          ],
        },
      },
      NetIncomeLoss: {
        units: {
          USD: [
            { start: '2024-09-29', end: '2025-09-27', val: 112_010_000_000, accn: '0000320193-25-000079', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31' },
            { start: '2023-10-01', end: '2024-09-28', val: 93_736_000_000, accn: '0000320193-25-000079', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31' },
          ],
        },
      },
      NetCashProvidedByUsedInOperatingActivities: {
        units: { USD: [{ start: '2024-09-29', end: '2025-09-27', val: 111_482_000_000, accn: '0000320193-25-000079', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31' }] },
      },
      PaymentsToAcquirePropertyPlantAndEquipment: {
        units: { USD: [{ start: '2024-09-29', end: '2025-09-27', val: 12_715_000_000, accn: '0000320193-25-000079', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31' }] },
      },
      StockholdersEquity: {
        units: {
          USD: [
            { end: '2025-09-27', val: 73_733_000_000, accn: '0000320193-25-000079', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31' },
            { end: '2024-09-28', val: 56_950_000_000, accn: '0000320193-25-000079', fy: 2025, fp: 'FY', form: '10-K', filed: '2025-10-31' },
          ],
        },
      },
    },
  },
};

describe('EDGAR fundamentals (step 40)', () => {
  it('keeps only full-year 10-K values, with filing ID and period', () => {
    const rev = extractAnnual(FACTS).filter((f) => f.concept === 'revenue');
    expect(rev.map((f) => [f.periodEnd, f.value])).toEqual([
      ['2025-09-27', 416_161_000_000],
      ['2024-09-28', 391_035_000_000],
    ]);
    // The most recent filing wins for a period reported twice.
    expect(rev[1]!.accn).toBe('0000320193-25-000079');
  });

  it('calculates growth, margin, ROE and free cash flow in the backend with inputs and sources', () => {
    freshApp();
    const db = getDb();
    const ins = db.prepare(
      "INSERT INTO facts (cik, concept, period_end, period_start, value, unit, tag, accn, form, filed, origin) VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, 'companyfacts')",
    );
    for (const f of extractAnnual(FACTS)) ins.run('0000320193', f.concept, f.periodEnd, f.periodStart, f.value, f.tag, f.accn, f.form, f.filed);
    const rows = annualRows('320193');
    const m = Object.fromEntries(computeMetrics('320193', rows).map((x) => [x.id, x]));
    expect(m.revenueGrowth!.value).toBeCloseTo(416_161 / 391_035 - 1, 6);
    expect(m.netMargin!.value).toBeCloseTo(112_010 / 416_161, 6);
    expect(m.roe!.value).toBeCloseTo(112_010 / ((73_733 + 56_950) / 2), 6);
    expect(m.freeCashFlow!.value).toBe(111_482_000_000 - 12_715_000_000);
    expect(m.netMargin!.formula).toBe('Net income ÷ Revenue');
    expect(m.netMargin!.period).toBe('FY ending 2025-09-27');
    expect(m.netMargin!.inputs[0]!.ref).toMatchObject({ accn: '0000320193-25-000079', form: '10-K', filed: '2025-10-31' });
  });
});

describe('screener (step 39)', () => {
  it('matches a manual check, and never passes a company with missing data', () => {
    freshApp();
    saveQuotesForTests([quote('AAPL', 231.4, 228.85), quote('MSFT', 468.1, 470.64)]);
    const up = screen({ minChangePct: 0 }).rows.map((r) => r.ticker);
    // Manual check: AAPL (231.40 vs 228.85) is up 1.11%; MSFT (468.10 vs 470.64) is down 0.54%.
    expect(up).toContain('AAPL');
    expect(up).not.toContain('MSFT');
    // A company with no stored quote never passes a price filter.
    expect(up).not.toContain('NVDA');
    const tech = screen({ sector: 'Information Technology', maxPrice: 300 }).rows.map((r) => r.ticker);
    expect(tech).toEqual(['AAPL']);
  });
});

describe('AI review guardrails (step 42)', () => {
  it('refuses to run without a key and a monthly cap', async () => {
    const { agent } = await loggedIn();
    const r = await agent.post('/api/research/AAPL/ai-review').set(H).expect(409);
    expect(r.body.error).toMatch(/ANTHROPIC_API_KEY/);
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    const r2 = await agent.post('/api/research/AAPL/ai-review').set(H).expect(409);
    expect(r2.body.error).toMatch(/MONTHLY_BUDGET/);
  });

  it('stops when the monthly budget is used up', async () => {
    const { agent } = await loggedIn();
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    process.env.ANTHROPIC_MONTHLY_BUDGET_USD = '1';
    getDb()
      .prepare("INSERT INTO ai_reviews (ticker, created_at, evidence_date, model, status, summary, points_json, sources_json, cost_usd) VALUES ('AAPL', ?, '2026-11-13', 'm', 'complete', 's', '[]', '[]', 0.99)")
      .run(new Date().toISOString());
    const r = await agent.post('/api/research/AAPL/ai-review').set(H).expect(409);
    expect(r.body.error).toMatch(/Monthly AI budget reached/);
  });
});

describe('keys stay on the server', () => {
  it('never returns a secret in any response', async () => {
    process.env.ALPACA_API_KEY_ID = 'PKSECRETKEYID123';
    process.env.ALPACA_API_SECRET_KEY = 'supersecretvalue456';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-secret-789';
    const { agent } = await loggedIn();
    for (const path of ['/api/settings', '/api/methodology', '/api/market/status']) {
      const r = await agent.get(path).expect(200);
      const body = JSON.stringify(r.body);
      expect(body).not.toContain('PKSECRETKEYID123');
      expect(body).not.toContain('supersecretvalue456');
      expect(body).not.toContain('sk-ant-secret-789');
    }
  });
});

describe('revenue tag choice', () => {
  it('uses total revenue, not a partial line, when a company reports both (e.g. REITs)', () => {
    const facts: CompanyFacts = {
      cik: 1,
      entityName: 'Example REIT',
      facts: {
        'us-gaap': {
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            units: { USD: [{ start: '2025-01-01', end: '2025-12-31', val: 50_000_000, accn: 'a', fp: 'FY', form: '10-K', filed: '2026-02-20' }] },
          },
          Revenues: {
            units: { USD: [{ start: '2025-01-01', end: '2025-12-31', val: 1_500_000_000, accn: 'a', fp: 'FY', form: '10-K', filed: '2026-02-20' }] },
          },
          NetIncomeLoss: {
            units: { USD: [{ start: '2025-01-01', end: '2025-12-31', val: 300_000_000, accn: 'a', fp: 'FY', form: '10-K', filed: '2026-02-20' }] },
          },
        },
      },
    };
    const rev = extractAnnual(facts).find((f) => f.concept === 'revenue')!;
    expect(rev.value).toBe(1_500_000_000);
    expect(rev.tag).toBe('Revenues');
  });
});
