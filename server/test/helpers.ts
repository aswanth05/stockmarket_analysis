import request from 'supertest';
import { createApp } from '../src/app';
import { resetRateLimitsForTests } from '../src/auth/service';
import { resetDbForTests } from '../src/db';
import { seedUniverse } from '../src/universe';

export const H = { 'X-Requested-With': 'ust' };
export const PASSWORD = 'correct horse 42';

export function freshApp() {
  resetDbForTests();
  resetRateLimitsForTests();
  seedUniverse();
  return createApp();
}

/** Signs up and returns a cookie-keeping agent. */
export async function loggedIn(app = freshApp(), email = 'owner@example.com') {
  const agent = request.agent(app);
  const r = await agent.post('/api/auth/signup').set(H).send({ email, password: PASSWORD });
  if (r.status !== 201) throw new Error(`signup failed: ${r.status} ${JSON.stringify(r.body)}`);
  return { app, agent };
}

/** Clears provider secrets so tests never call the network. */
export function noProviders() {
  for (const k of ['ALPACA_API_KEY_ID', 'ALPACA_API_SECRET_KEY', 'EODHD_API_TOKEN', 'SEC_EDGAR_USER_AGENT', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MONTHLY_BUDGET_USD', 'ALLOW_SIGNUP']) {
    delete process.env[k];
  }
}
