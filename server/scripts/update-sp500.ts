/**
 * Refreshes server/data/sp500.json from Wikipedia's "List of S&P 500 companies" table.
 * Run: npm run update:sp500 -w server
 * The list is the app's stored universe (CLAUDE.md: define any US universe explicitly).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const URL_ = 'https://en.wikipedia.org/w/index.php?title=List_of_S%26P_500_companies&action=render';
const out = fileURLToPath(new URL('../data/sp500.json', import.meta.url));

const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();

const res = await fetch(URL_, { headers: { 'User-Agent': 'us-stock-terminal/0.1 (data refresh script)' } });
if (!res.ok) throw new Error(`Wikipedia returned ${res.status}`);
const html = await res.text();

const table = html.match(/<table[^>]*id="constituents"[\s\S]*?<\/table>/)?.[0];
if (!table) throw new Error('Constituents table not found; the page layout may have changed.');

const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].slice(1);
const companies = rows
  .map(([row]) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1] ?? '')))
  .filter((c) => c.length >= 7)
  .map((c) => ({
    // Wikipedia uses BRK.B style; providers use the same dot form for class shares.
    ticker: c[0]!,
    name: c[1]!,
    sector: c[2]!,
    subIndustry: c[3]!,
    cik: c[6]!.padStart(10, '0'),
  }));

if (companies.length < 490) throw new Error(`Only ${companies.length} rows parsed; refusing to overwrite.`);

writeFileSync(
  out,
  JSON.stringify(
    { source: 'Wikipedia, List of S&P 500 companies', sourceUrl: URL_, retrievedAt: new Date().toISOString(), companies },
    null,
    1,
  ),
);
console.log(`Saved ${companies.length} companies to ${out}`);
