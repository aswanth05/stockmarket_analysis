import Anthropic from '@anthropic-ai/sdk';
import { findBannedWording, type AiReviewView, type AiUsageView, type SourceRef } from '@ust/shared';
import { secrets } from '../config';
import { getDb, nowIso } from '../db';

/**
 * AI review (step 42). Claude explains evidence the backend already stored and calculated;
 * it never computes or looks up numbers (CLAUDE.md, AI rules).
 */
export const MODEL = 'claude-opus-5-5';
const PRICE_IN_PER_TOKEN = 4 / 1e6;
const PRICE_OUT_PER_TOKEN = 20 / 1e6;
const MAX_TOKENS = 4000;

export interface Evidence {
  ticker: string;
  companyName: string;
  sector: string | null;
  /** Newest date among the evidence items. */
  evidenceDate: string;
  /** Already-calculated facts, as plain lines, each naming its period and source. */
  facts: string[];
  sources: SourceRef[];
}

const SYSTEM = `You write short, neutral research notes for a private US stock research app.
Rules:
- Use only the evidence provided. Do not add facts, numbers, prices, dates or sources that are not in it.
- Do not calculate new numbers. You may restate a number exactly as given.
- Never recommend an action. Do not use the words "buy", "sell", "hold", "strong buy", "outperform", "underperform", price targets, or any rating.
- Explain what the evidence shows and what it does not show. Mention missing data plainly.
- Plain English for a non-expert reader.`;

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two to four sentences.' },
    points: { type: 'array', items: { type: 'string' }, description: 'Three to six short observations, each tied to the evidence.' },
  },
  required: ['summary', 'points'],
  additionalProperties: false,
} as const;

function monthStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function usage(now = new Date()): AiUsageView {
  const spent = (getDb().prepare('SELECT COALESCE(SUM(cost_usd), 0) AS s FROM ai_reviews WHERE created_at >= ?').get(monthStartIso(now)) as { s: number }).s;
  const budget = secrets.anthropicBudgetUsd();
  return { monthSpendUsd: Math.round(spent * 10000) / 10000, monthlyBudgetUsd: budget, remainingUsd: budget == null ? null : Math.max(0, Math.round((budget - spent) * 10000) / 10000) };
}

interface ReviewRow {
  id: number;
  ticker: string;
  created_at: string;
  evidence_date: string;
  model: string;
  status: AiReviewView['status'];
  summary: string;
  points_json: string;
  sources_json: string;
}

const toView = (r: ReviewRow): AiReviewView => ({
  id: r.id,
  ticker: r.ticker,
  createdAt: r.created_at,
  evidenceDate: r.evidence_date,
  model: r.model,
  status: r.status,
  summary: r.summary,
  points: JSON.parse(r.points_json),
  sources: JSON.parse(r.sources_json),
});

export function latestReview(ticker: string): AiReviewView | null {
  const r = getDb().prepare("SELECT * FROM ai_reviews WHERE ticker = ? AND status = 'complete' ORDER BY id DESC LIMIT 1").get(ticker) as ReviewRow | undefined;
  return r ? toView(r) : null;
}

export function latestReviewAny(tickers: string[]): AiReviewView | null {
  if (!tickers.length) return null;
  const r = getDb()
    .prepare("SELECT * FROM ai_reviews WHERE status = 'complete' AND ticker IN (SELECT value FROM json_each(?)) ORDER BY id DESC LIMIT 1")
    .get(JSON.stringify(tickers)) as ReviewRow | undefined;
  return r ? toView(r) : null;
}

function store(e: Evidence, status: AiReviewView['status'], summary: string, points: string[], inTok: number, outTok: number): AiReviewView {
  const cost = inTok * PRICE_IN_PER_TOKEN + outTok * PRICE_OUT_PER_TOKEN;
  const at = nowIso();
  const r = getDb()
    .prepare(
      'INSERT INTO ai_reviews (ticker, created_at, evidence_date, model, status, summary, points_json, sources_json, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(e.ticker, at, e.evidenceDate, MODEL, status, summary, JSON.stringify(points), JSON.stringify(e.sources), inTok, outTok, cost);
  return { id: Number(r.lastInsertRowid), ticker: e.ticker, createdAt: at, evidenceDate: e.evidenceDate, model: MODEL, status, summary, points, sources: e.sources };
}

export class AiUnavailable extends Error {}

export async function generateReview(e: Evidence): Promise<AiReviewView> {
  const key = secrets.anthropicKey();
  const budget = secrets.anthropicBudgetUsd();
  if (!key) throw new AiUnavailable('ANTHROPIC_API_KEY is not configured.');
  if (budget == null) throw new AiUnavailable('ANTHROPIC_MONTHLY_BUDGET_USD is not set. A monthly cap is required before AI reviews run.');
  // Worst case for this call: generous input estimate plus the full output allowance.
  const worstCase = 8000 * PRICE_IN_PER_TOKEN + MAX_TOKENS * PRICE_OUT_PER_TOKEN;
  const u = usage();
  if ((u.remainingUsd ?? 0) < worstCase) {
    throw new AiUnavailable(`Monthly AI budget reached ($${u.monthSpendUsd.toFixed(2)} of $${budget.toFixed(2)}). New reviews resume next month.`);
  }
  if (!e.facts.length) throw new AiUnavailable('There is no stored evidence for this company yet, so there is nothing to review.');

  const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 120_000 });
  const prompt = `Company: ${e.companyName} (${e.ticker})${e.sector ? `, sector: ${e.sector}` : ''}
Evidence date: ${e.evidenceDate}

Evidence (calculated by the app; each line names its period and source):
${e.facts.map((f) => `- ${f}`).join('\n')}

Write the research note.`;

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Server-side fallback: if Opus 5.5 declines, the API retries on a suitable model in the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  });

  const inTok = response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0);
  const outTok = response.usage.output_tokens;

  if (response.stop_reason === 'refusal') return store(e, 'rejected', 'The AI model declined to write this review.', [], inTok, outTok);
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let parsed: { summary: string; points: string[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    return store(e, 'failed', 'The AI response could not be read.', [], inTok, outTok);
  }
  const banned = findBannedWording([parsed.summary, ...parsed.points].join(' '));
  if (banned.length) {
    return store(e, 'rejected', `Review withheld: it used recommendation wording (${banned.join(', ')}), which this app does not show.`, [], inTok, outTok);
  }
  return store(e, 'complete', parsed.summary, parsed.points.slice(0, 8), inTok, outTok);
}
