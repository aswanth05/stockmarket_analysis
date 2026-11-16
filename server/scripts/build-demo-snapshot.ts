/**
 * Builds the public demo's data: real SEC EDGAR financials and filings for the saved S&P 500 list,
 * written as static JSON for GitHub Pages. No prices (provider terms), no keys in the output.
 *
 * Run: SEC_EDGAR_USER_AGENT="Name email@example.com" npm run demo:snapshot -w server
 * Output: web/public/demo-data/summary.json and web/public/demo-data/companies/<TICKER>.json
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FilingView } from '@ust/shared';
import { netMargin, revenueGrowth } from '../src/calculations/engine';
import { providersConfigured } from '../src/config';
import { CONCEPT_TAGS, extractAnnual } from '../src/fundamentals/extract';
import { priorEquityFromFacts, rowsFromFacts, type FactRow } from '../src/fundamentals/rows';
import { companyFacts, filingUrl, frame, padCik, submissions, tickersWithExchange, type FrameRow } from '../src/providers/edgar';
import { SP500 } from '../src/universe';

const OUT = fileURLToPath(new URL('../../web/public/demo-data/', import.meta.url));
const FORMS = new Set(['10-K', '10-K/A', '10-Q', '10-Q/A', '8-K', '8-K/A', 'DEF 14A']);
const write = (path: string, data: unknown) => writeFileSync(`${OUT}${path}`, JSON.stringify(data));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}companies`, { recursive: true });

if (!providersConfigured().edgar) {
  write('summary.json', { status: 'not-configured', generatedAt: new Date().toISOString() });
  console.log('SEC_EDGAR_USER_AGENT is not set: wrote an empty demo snapshot.');
  process.exit(0);
}

const started = Date.now();
const exchanges = new Map((await tickersWithExchange()).map((t) => [t.ticker, t.exchange]));

/* Calendar-year frames: one request per tag and year gives revenue/net income for every company. */
const year = new Date().getUTCFullYear() - 1;
async function bestByCik(tags: readonly string[], period: string) {
  const out = new Map<string, FrameRow>();
  for (const tag of tags) for (const row of await frame(tag, period)) if (!out.has(padCik(row.cik))) out.set(padCik(row.cik), row);
  return out;
}
const revNow = await bestByCik(CONCEPT_TAGS.revenue, `CY${year}`);
const revPrev = await bestByCik(CONCEPT_TAGS.revenue, `CY${year - 1}`);
const niNow = await bestByCik(CONCEPT_TAGS.netIncome, `CY${year}`);
const period = `CY${year} vs CY${year - 1}`;

const companies: Record<string, unknown> = {};
let failures = 0;
for (const [i, c] of SP500.companies.entries()) {
  const cik = padCik(c.cik);
  const entry: Record<string, unknown> = {
    exchange: exchanges.get(c.ticker) ?? null,
    revenueGrowth: revenueGrowth(revNow.get(cik)?.val ?? null, revPrev.get(cik)?.val ?? null).value,
    netMargin: netMargin(niNow.get(cik)?.val ?? null, revNow.get(cik)?.val ?? null).value,
    period,
  };
  try {
    const [facts, subs] = await Promise.all([companyFacts(cik), submissions(cik)]);
    const rowsIn: FactRow[] = extractAnnual(facts).map((f) => ({
      concept: f.concept,
      period_end: f.periodEnd,
      period_start: f.periodStart,
      value: f.value,
      tag: f.tag,
      accn: f.accn,
      form: f.form,
      filed: f.filed,
    }));
    const annual = rowsFromFacts(cik, rowsIn);
    const r = subs.filings.recent;
    const filings: FilingView[] = [];
    for (let k = 0; k < r.accessionNumber.length && filings.length < 12; k++) {
      if (!FORMS.has(r.form[k]!)) continue;
      filings.push({
        ticker: c.ticker,
        form: r.form[k]!,
        filed: r.filingDate[k]!,
        reportDate: r.reportDate[k] || null,
        description: r.primaryDocDescription[k] || r.form[k]!,
        accn: r.accessionNumber[k]!,
        url: filingUrl(cik, r.accessionNumber[k]!, r.primaryDocument[k] || null),
      });
    }
    write(`companies/${c.ticker}.json`, {
      ticker: c.ticker,
      exchange: subs.exchanges[0] ?? entry.exchange,
      annual,
      priorEquity: annual[0] ? priorEquityFromFacts(cik, rowsIn, annual[0].end) ?? null : null,
      filings,
    });
    entry.exchange = subs.exchanges[0] ?? entry.exchange;
    entry.hasAnnual = annual.length > 0;
    entry.latestFiling = filings[0] ? { form: filings[0].form, filed: filings[0].filed } : null;
  } catch (e) {
    failures++;
    entry.error = e instanceof Error ? e.message.slice(0, 160) : String(e);
  }
  companies[c.ticker] = entry;
  if ((i + 1) % 50 === 0) console.log(`${i + 1}/${SP500.companies.length} companies`);
}

write('summary.json', {
  status: 'ok',
  generatedAt: new Date().toISOString(),
  source: 'SEC EDGAR (company facts, submissions, XBRL frames)',
  universe: { source: SP500.source, retrievedAt: SP500.retrievedAt },
  period,
  failures,
  companies,
});
console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s: ${SP500.companies.length - failures} companies, ${failures} failed.`);
if (failures > SP500.companies.length / 2) process.exit(1);
