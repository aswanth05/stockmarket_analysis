import { Router } from 'express';
import type { HealthResponse } from '@ust/shared';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = { status: 'ok', serverTime: new Date().toISOString() };
  res.json(body);
});
