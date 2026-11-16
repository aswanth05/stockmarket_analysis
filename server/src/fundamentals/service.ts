import type { AnnualRow, FilingView, MetricView, SourceRef } from '@ust/shared';
import { freeCashFlow, netMargin, revenueGrowth } from '../calculations/engine';
import { buildMetrics, factorScores, riskFlags } from './compute';
import { getDb, nowIso } from '../db';
import { companyFacts, filingUrl, frame, padCik, submissions } from '../providers/edgar';
import { CONCEPT_TAGS, extractAnnual, type Concept } from './extract';

const FACTS_TTL_MS = 24 * 3600_000;
const TRACKED_FORMS = new Set(['10-K', '10-K/A', '10-Q', '10-Q/A', '8-K', '8-K/A', 'DEF 14A', 'S-1', '20-F', '6-K']);

interface FactRow {
  concept: Concept;
  period_end: string;
  period_start: string | null;
  value: number;
  tag: string;
  accn: string;
  form: string;
  filed: string;
}

export function factsStatus(cik: string): { loaded_at: string; status: string; error: string | null } | undefined {
  return getDb().prepare('SELECT loaded_at, status, error FROM facts_loaded WHERE cik = ?').get(padCik(cik)) as
    | { loaded_at: string; status: string; error: string | null }
    | undefined;
}

/** Fetch and store one company's annual facts and recent filings, at most once a day. */
export async function loadCompany(cik: string, force = false): Promise<void> {
  const db = getDb();
  const id = padCik(cik);
  const st = factsStatus(id);
  if (!force && st?.status === 'ok' && Date.now() - Date.parse(st.loaded_at) < FACTS_TTL_MS) return;
  try {
    const [facts, subs] = await Promise.all([companyFacts(id), submissions(id)]);
    const annual = extractAnnual(facts);
    const r = subs.filings.recent;
    db.exec('BEGIN');
    db.prepare("DELETE FROM facts WHERE cik = ? AND origin = 'companyfacts'").run(id);
    const ins = db.prepare(
      "INSERT INTO facts (cik, concept, period_end, period_start, value, unit, tag, accn, form, filed, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'companyfacts')",
    );
    for (const f of annual) ins.run(id, f.concept, f.periodEnd, f.periodStart, f.value, f.unit, f.tag, f.accn, f.form, f.filed);
    const insF = db.prepare(
      'INSERT OR REPLACE INTO filings (accn, cik, form, filed, report_date, primary_doc, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (let i = 0; i < Math.min(r.accessionNumber.length, 200); i++) {
      if (!TRACKED_FORMS.has(r.form[i]!)) continue;
      insF.run(r.accessionNumber[i]!, id, r.form[i]!, r.filingDate[i]!, r.reportDate[i] || null, r.primaryDocument[i] || null, r.primaryDocDescription[i] || null);
    }
    if (subs.exchanges[0]) db.prepare('UPDATE companies SET exchange = ? WHERE cik = ? AND exchange IS NULL').run(subs.exchanges[0], id);
    db.prepare("INSERT OR REPLACE INTO facts_loaded (cik, loaded_at, status, error) VALUES (?, ?, 'ok', NULL)").run(id, nowIso());
    db.exec('COMMIT');
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK');
    const msg = e instanceof Error ? e.message : String(e);
    db.prepare("INSERT OR REPLACE INTO facts_loaded (cik, loaded_at, status, error) VALUES (?, ?, 'error', ?)").run(id, nowIso(), msg.slice(0, 300));
    throw e;
  }
}

const refOf = (cik: string, f: FactRow | undefined): SourceRef | undefined =>
  f && { source: `SEC EDGAR, ${f.tag}`, form: f.form, accn: f.accn, filed: f.filed, url: filingUrl(cik, f.accn) };

export function annualRows(cik: string): AnnualRow[] {
  const id = padCik(cik);
  const rows = getDb()
    .prepare("SELECT concept, period_end, period_start, value, tag, accn, form, filed FROM facts WHERE cik = ? AND origin = 'companyfacts'")
    .all(id) as unknown as FactRow[];
  const by = (c: Concept) => new Map(rows.filter((r) => r.concept === c).map((r) => [r.period_end, r]));
  const rev = by('revenue');
  const ni = by('netIncome');
  const cfo = by('operatingCashFlow');
  const capex = by('capex');
  const eq = by('equity');
  const ends = [...new Set([...rev.keys(), ...ni.keys()])].sort().reverse().slice(0, 6);
  return ends.map((end) => {
    const fcf = freeCashFlow(cfo.get(end)?.value ?? null, capex.get(end)?.value ?? null).value;
    return {
      end,
      revenue: rev.get(end)?.value ?? null,
      netIncome: ni.get(end)?.value ?? null,
      operatingCashFlow: cfo.get(end)?.value ?? null,
      capex: capex.get(end)?.value ?? null,
      freeCashFlow: fcf,
      equity: eq.get(end)?.value ?? null,
      refs: {
        revenue: refOf(id, rev.get(end)),
        netIncome: refOf(id, ni.get(end)),
        operatingCashFlow: refOf(id, cfo.get(end)),
        capex: refOf(id, capex.get(end)),
        equity: refOf(id, eq.get(end)),
      },
    };
  });
}

/** The fiscal-year end before `end` among stored equity values (balance sheets can be dated a few days apart). */
function priorEquity(cik: string, end: string): FactRow | undefined {
  return getDb()
    .prepare(
      "SELECT concept, period_end, period_start, value, tag, accn, form, filed FROM facts WHERE cik = ? AND origin = 'companyfacts' AND concept = 'equity' AND period_end < ? ORDER BY period_end DESC LIMIT 1",
    )
    .get(padCik(cik), end) as FactRow | undefined;
}

export function computeMetrics(cik: string, rows: AnnualRow[]): MetricView[] {
  const cur = rows[0];
  if (!cur) return [];
  const prevEq = priorEquity(cik, cur.end);
  return buildMetrics(rows, prevEq && { value: prevEq.value, end: prevEq.period_end, ref: refOf(cik, prevEq) });
}

export { factorScores, riskFlags };

export function recentFilings(cik: string, ticker: string, limit = 12): FilingView[] {
  const rows = getDb()
    .prepare('SELECT accn, form, filed, report_date, primary_doc, description FROM filings WHERE cik = ? ORDER BY filed DESC LIMIT ?')
    .all(padCik(cik), limit) as { accn: string; form: string; filed: string; report_date: string | null; primary_doc: string | null; description: string | null }[];
  return rows.map((r) => ({
    ticker,
    form: r.form,
    filed: r.filed,
    reportDate: r.report_date,
    description: r.description || r.form,
    accn: r.accn,
    url: filingUrl(cik, r.accn, r.primary_doc),
  }));
}

/* ---------- Bulk (frames) for the screener and sector outlook ---------- */

export const FRAMES_CONCEPTS: Concept[] = ['revenue', 'netIncome'];

/** Calendar-year frames for the latest complete year and the one before. ~14 small requests. */
export async function refreshFrames(now = new Date()) {
  const db = getDb();
  const y = now.getUTCFullYear() - 1;
  for (const year of [y, y - 1]) {
    for (const concept of FRAMES_CONCEPTS) {
      const tags = CONCEPT_TAGS[concept];
      const best = new Map<string, { tag: string; rank: number; row: Awaited<ReturnType<typeof frame>>[number] }>();
      for (let rank = 0; rank < tags.length; rank++) {
        const rows = await frame(tags[rank]!, `CY${year}`);
        for (const row of rows) {
          const cik = padCik(row.cik);
          if (!best.has(cik)) best.set(cik, { tag: tags[rank]!, rank, row });
        }
      }
      db.exec('BEGIN');
      const ins = db.prepare(
        "INSERT OR REPLACE INTO facts (cik, concept, period_end, period_start, value, unit, tag, accn, form, filed, origin) VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, 'frames')",
      );
      db.prepare("DELETE FROM facts WHERE origin = 'frames' AND concept = ? AND filed = ?").run(concept, `CY${year}`);
      for (const [cik, { tag, row }] of best) ins.run(cik, concept, row.end, row.start ?? null, row.val, tag, row.accn, 'frame', `CY${year}`);
      db.exec('COMMIT');
    }
  }
}

export interface BulkFundamentals {
  revenueGrowth: number | null;
  netMargin: number | null;
  period: string | null;
}

/** Revenue growth and net margin per CIK from calendar-year frames (CY latest vs CY prior). */
export function bulkFundamentals(): Map<string, BulkFundamentals> {
  const rows = getDb()
    .prepare("SELECT cik, concept, period_end, value, filed FROM facts WHERE origin = 'frames'")
    .all() as { cik: string; concept: Concept; period_end: string; value: number; filed: string }[];
  const byCik = new Map<string, { revenue: Map<string, number>; netIncome: Map<string, number> }>();
  for (const r of rows) {
    const e = byCik.get(r.cik) ?? { revenue: new Map(), netIncome: new Map() };
    // `filed` holds the calendar frame label, e.g. CY2025.
    (r.concept === 'revenue' ? e.revenue : e.netIncome).set(r.filed, r.value);
    byCik.set(r.cik, e);
  }
  const out = new Map<string, BulkFundamentals>();
  for (const [cik, e] of byCik) {
    const years = [...e.revenue.keys()].sort().reverse();
    const latest = years[0];
    if (!latest) continue;
    const prior = `CY${Number(latest.slice(2)) - 1}`;
    out.set(cik, {
      revenueGrowth: revenueGrowth(e.revenue.get(latest) ?? null, e.revenue.get(prior) ?? null).value,
      netMargin: netMargin(e.netIncome.get(latest) ?? null, e.revenue.get(latest) ?? null).value,
      period: `${latest} vs ${prior}`,
    });
  }
  return out;
}
