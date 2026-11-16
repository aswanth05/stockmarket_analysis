import { config, providersConfigured } from './config';
import { createApp } from './app';
import { getDb } from './db';
import { startScheduler } from './jobs/scheduler';
import { seedUniverse } from './universe';

getDb();
seedUniverse();
startScheduler();

createApp().listen(config.port, () => {
  const p = providersConfigured();
  const list = (Object.keys(p) as (keyof typeof p)[]).map((k) => `${k}: ${p[k] ? 'configured' : 'not configured'}`).join(', ');
  console.log(`API server listening on http://localhost:${config.port}`);
  console.log(`Data sources: ${list}`);
});
