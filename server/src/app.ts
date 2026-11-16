import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { loadUser, requireAuth, sameOriginWrites } from './auth/middleware';
import { config } from './config';
import { apiRouter } from './routes/api';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Behind a hosting proxy (step 44), trust it so req.ip is the visitor, not the proxy.
  if (config.isProduction) app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', sameOriginWrites, loadUser);
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  // Everything else is behind login (CLAUDE.md: users log in before any terminal screen).
  app.use('/api', requireAuth, apiRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // In production the server also serves the built frontend.
  if (config.isProduction && existsSync(config.webDist)) {
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(config.webDist, 'index.html')));
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
