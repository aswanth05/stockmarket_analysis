import { Router, type Request, type Response } from 'express';
import type { MarketStatusResponse } from '@ust/shared';
import { AiUnavailable, generateReview, usage } from '../ai/service';
import { barsResponse } from '../bars/service';
import { providersConfigured } from '../config';
import { marketStatus } from '../market/calendar';
import { getQuotes } from '../quotes/service';
import { getCompany, normalizeTicker, TICKER_RE } from '../universe';
import { emptyQuote } from '../views/common';
import { homeView } from '../views/home';
import { methodologyView } from '../views/methodology';
import { buildEvidence, researchView, warmCompany } from '../views/research';
import { parseFilters, screen, sectorsView } from '../views/screener';
import { addToWatchlist, removeFromWatchlist, search, watchlistView } from '../views/watchlist';
import { refreshWatchlistNow } from '../jobs/scheduler';

export const apiRouter = Router();

/** Validates :ticker and resolves the company, or answers 400/404. */
function company(req: Request, res: Response) {
  const t = normalizeTicker(String(req.params.ticker ?? ''));
  if (!TICKER_RE.test(t)) {
    res.status(400).json({ error: 'That is not a valid US ticker.' });
    return null;
  }
  const c = getCompany(t);
  if (!c) {
    res.status(404).json({ error: `${t} is not in the app’s list of NYSE and Nasdaq companies.` });
    return null;
  }
  return c;
}

apiRouter.get('/market/status', (_req, res) => {
  const body: MarketStatusResponse = { ...marketStatus(), providers: providersConfigured() };
  res.json(body);
});

apiRouter.get('/home', (req, res) => {
  res.json(homeView(req.user!.id));
});

/** Polling endpoint for live updates: stored quotes only, kept fresh by the background job. */
apiRouter.get('/quotes', (req, res) => {
  const list = String(req.query.tickers ?? '')
    .split(',')
    .map(normalizeTicker)
    .filter((t) => TICKER_RE.test(t))
    .slice(0, 50);
  const q = getQuotes(list);
  res.json({ quotes: list.map((t) => q.get(t) ?? emptyQuote(t)), market: marketStatus() });
});

apiRouter.get('/search', (req, res) => {
  res.json({ results: search(String(req.query.q ?? '').slice(0, 40)) });
});

apiRouter.get('/research/:ticker', async (req, res) => {
  const c = company(req, res);
  if (!c) return;
  const { fundamentalsError } = await warmCompany(c);
  res.json(researchView(getCompany(c.ticker)!, fundamentalsError));
});

apiRouter.get('/bars/:ticker', (req, res) => {
  const c = company(req, res);
  if (!c) return;
  res.json(barsResponse(c.ticker, Math.min(Number(req.query.days) || 260, 400)));
});

apiRouter.post('/research/:ticker/ai-review', async (req, res) => {
  const c = company(req, res);
  if (!c) return;
  try {
    await warmCompany(c);
    res.json({ review: await generateReview(buildEvidence(c)), usage: usage() });
  } catch (e) {
    if (e instanceof AiUnavailable) {
      res.status(409).json({ error: e.message });
      return;
    }
    console.error('AI review failed:', e instanceof Error ? e.message : e);
    res.status(502).json({ error: 'The AI review could not be created. Try again later.' });
  }
});

apiRouter.get('/screener', (req, res) => {
  res.json(screen(parseFilters(req.query as Record<string, unknown>)));
});

apiRouter.get('/sectors', (_req, res) => {
  res.json(sectorsView());
});

apiRouter.get('/watchlist', async (req, res) => {
  await refreshWatchlistNow(req.user!.id);
  res.json({ items: watchlistView(req.user!.id) });
});

apiRouter.post('/watchlist', (req, res) => {
  const t = normalizeTicker(String(req.body?.ticker ?? ''));
  if (!TICKER_RE.test(t)) {
    res.status(400).json({ error: 'That is not a valid US ticker.' });
    return;
  }
  const r = addToWatchlist(req.user!.id, t);
  if (r === 'unknown') res.status(404).json({ error: `${t} is not in the app’s list of NYSE and Nasdaq companies.` });
  else if (r === 'full') res.status(400).json({ error: 'Your watchlist is full (100 companies).' });
  else res.status(r === 'exists' ? 200 : 201).json({ items: watchlistView(req.user!.id) });
});

apiRouter.delete('/watchlist/:ticker', (req, res) => {
  removeFromWatchlist(req.user!.id, normalizeTicker(String(req.params.ticker)));
  res.json({ items: watchlistView(req.user!.id) });
});

apiRouter.get('/methodology', (_req, res) => {
  res.json(methodologyView());
});

apiRouter.get('/settings', (req, res) => {
  res.json({ user: req.user, providers: providersConfigured(), aiUsage: usage(), sources: methodologyView().sources });
});
