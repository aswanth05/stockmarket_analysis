import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { freshApp, H, loggedIn, noProviders, PASSWORD } from './helpers';

beforeEach(noProviders);

describe('accounts and sessions (step 28)', () => {
  it('blocks every terminal endpoint when logged out', async () => {
    const app = freshApp();
    for (const path of ['/api/home', '/api/watchlist', '/api/research/AAPL', '/api/screener', '/api/sectors', '/api/methodology', '/api/settings', '/api/market/status', '/api/quotes?tickers=AAPL']) {
      const r = await request(app).get(path);
      expect(r.status, path).toBe(401);
    }
  });

  it('signs up, sets an httpOnly cookie, and logs out', async () => {
    const app = freshApp();
    const r = await request(app).post('/api/auth/signup').set(H).send({ email: 'a@example.com', password: PASSWORD });
    expect(r.status).toBe(201);
    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toMatch(/ust_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const agent = request.agent(app);
    await agent.post('/api/auth/login').set(H).send({ email: 'a@example.com', password: PASSWORD }).expect(200);
    await agent.get('/api/home').expect(200);
    await agent.post('/api/auth/logout').set(H).expect(200);
    await agent.get('/api/home').expect(401);
  });

  it('stores only a bcrypt hash, never the password', async () => {
    const app = freshApp();
    await request(app).post('/api/auth/signup').set(H).send({ email: 'b@example.com', password: PASSWORD }).expect(201);
    const { getDb } = await import('../src/db');
    const row = getDb().prepare('SELECT password_hash FROM users').get() as { password_hash: string };
    expect(row.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(row.password_hash).not.toContain(PASSWORD);
  });

  it('enforces password rules with a clear message', async () => {
    const r = await request(freshApp()).post('/api/auth/signup').set(H).send({ email: 'c@example.com', password: 'short' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/at least 10 characters/);
  });

  it('closes sign-up after the first account unless ALLOW_SIGNUP=true', async () => {
    const { app } = await loggedIn();
    const r = await request(app).post('/api/auth/signup').set(H).send({ email: 'second@example.com', password: PASSWORD });
    expect(r.status).toBe(403);
    process.env.ALLOW_SIGNUP = 'true';
    await request(app).post('/api/auth/signup').set(H).send({ email: 'second@example.com', password: PASSWORD }).expect(201);
  });

  it('gives the same message for a wrong password and an unknown email', async () => {
    const { app } = await loggedIn();
    const a = await request(app).post('/api/auth/login').set(H).send({ email: 'owner@example.com', password: 'wrong password 1' });
    const b = await request(app).post('/api/auth/login').set(H).send({ email: 'nobody@example.com', password: 'wrong password 1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it('rate-limits repeated failed logins', async () => {
    const { app } = await loggedIn();
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').set(H).send({ email: 'owner@example.com', password: 'wrong password 1' });
    const r = await request(app).post('/api/auth/login').set(H).send({ email: 'owner@example.com', password: PASSWORD });
    expect(r.status).toBe(429);
  });

  it('rejects state-changing requests that do not come from the app', async () => {
    const { agent } = await loggedIn();
    await agent.post('/api/watchlist').send({ ticker: 'AAPL' }).expect(403);
    await agent.post('/api/watchlist').set(H).set('Origin', 'https://evil.example').send({ ticker: 'AAPL' }).expect(403);
  });

  it('changes the password and requires the current one', async () => {
    const { agent } = await loggedIn();
    await agent.post('/api/auth/password').set(H).send({ current: 'nope', next: 'brand new pass 9' }).expect(400);
    await agent.post('/api/auth/password').set(H).send({ current: PASSWORD, next: 'brand new pass 9' }).expect(200);
  });
});
